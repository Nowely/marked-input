import {nextText} from '../../../shared/checkers'

export function getCaretIndex(element: HTMLElement): number {
	const selection = window.getSelection()
	if (!selection?.rangeCount) return 0
	const range = selection.getRangeAt(0)
	const preCaretRange = range.cloneRange()
	preCaretRange.selectNodeContents(element)
	preCaretRange.setEnd(range.endContainer, range.endOffset)
	return preCaretRange.toString().length
}

export function getRect(): DOMRect | null {
	try {
		const range = window.getSelection()?.getRangeAt(0)
		return range?.getBoundingClientRect() ?? null
	} catch {
		return null
	}
}

/**
 * SCROLL THE CARET BACK ONTO THE SCREEN, and by the smallest amount that does it.
 *
 * The editor writes its own caret, so the browser's own "keep the caret visible" never runs: a
 * programmatic `Selection.collapse` scrolls nothing. Typing at the end of a long page put the
 * caret at y=882 of a 900px viewport and the scroll position never moved — the next line was
 * typed below the fold.
 *
 * EVERY SCROLLER ON THE WAY UP, innermost first, and then the viewport: the editor may sit in a
 * consumer's `overflow: auto` box, in the page, or in both. The rect is RE-READ per step because
 * scrolling one ancestor moves it — a single measurement would over-scroll the next.
 *
 * `measure` rather than a rect, for that reason. It answers `undefined` when there is no caret to
 * follow, which ends the walk.
 */
export function revealCaret(from: HTMLElement, measure: () => DOMRect | null): void {
	for (let element: HTMLElement | null = from; element; element = element.parentElement) {
		// The CHEAP half of the scroller test first, and it is on the keystroke path: this runs
		// after every caret placement, and `getComputedStyle` on every ancestor of every editor on
		// every character is a cost nothing here needs to pay. An element with no overflow to
		// scroll cannot be the one clipping the caret whatever its `overflow` says.
		if (!overflows(element)) continue
		if (!isScroller(element)) continue
		const rect = measure()
		if (!rect) return
		const box = element.getBoundingClientRect()
		const top = box.top + element.clientTop
		const left = box.left + element.clientLeft
		element.scrollTop += scrollDelta(rect.top, rect.bottom, top, top + element.clientHeight)
		element.scrollLeft += scrollDelta(rect.left, rect.right, left, left + element.clientWidth)
	}
	const rect = measure()
	if (!rect) return
	const x = scrollDelta(rect.left, rect.right, 0, window.innerWidth)
	const y = scrollDelta(rect.top, rect.bottom, 0, window.innerHeight)
	if (x !== 0 || y !== 0) window.scrollBy(x, y)
}

/**
 * How far to scroll so that `[lo, hi]` sits inside `[min, max]`, and 0 when it already does.
 * NEAR EDGE WINS when the span is taller than the box: a caret taller than its scroller is
 * followed by its top, which is where the text being typed is.
 */
function scrollDelta(lo: number, hi: number, min: number, max: number): number {
	if (lo < min) return lo - min
	if (hi > max) return Math.min(hi - max, lo - min)
	return 0
}

/** Has this element anything to scroll at all — two property reads, no style resolution. */
function overflows(element: HTMLElement): boolean {
	return element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth
}

/**
 * Does this element scroll its overflow — `auto`/`scroll` on the axis that overflows. `hidden` is
 * deliberately NOT one: it is a consumer saying the box does not move, and a programmatic scroll
 * of it is a layout the consumer did not ask for.
 */
function isScroller(element: HTMLElement): boolean {
	const style = getComputedStyle(element)
	const scrolls = (value: string) => value === 'auto' || value === 'scroll'
	return (
		(scrolls(style.overflowY) && element.scrollHeight > element.clientHeight) ||
		(scrolls(style.overflowX) && element.scrollWidth > element.clientWidth)
	)
}

/**
 * A concrete DOM boundary — what a `Range` endpoint and a collapsed caret both take. TWO
 * shapes reach it and they are not interchangeable: a text surface resolves to (Text, char
 * offset), while a MARK has no anchorable interior and resolves to its PARENT plus the child
 * index before or after it. Naming the pair is what lets a range span one of each.
 */
export type CaretBoundary = {node: Node; offset: number}

/**
 * Resolve a character offset within a structural text surface to a concrete
 * (Text, offset) pair. If the surface contains no Text node, append an empty
 * one and target it. Used by `TokenHandle.caretBoundary` — needs the
 * empty-Text fallback so freshly-mounted empty surfaces still accept a caret.
 */
export function findTextBoundary(surface: HTMLElement, offset: number): {node: Text; offset: number} {
	const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT)
	let remaining = Math.max(0, offset)
	let node = nextText(walker)
	while (node) {
		if (remaining <= node.length) return {node, offset: remaining}
		remaining -= node.length
		node = nextText(walker)
	}
	const text = surface.firstChild instanceof Text ? surface.firstChild : document.createTextNode('')
	if (!text.parentNode) surface.append(text)
	return {node: text, offset: text.length}
}

/**
 * THE collapsed placement: one boundary of either shape becomes the whole selection.
 *
 * `Selection.collapse`, not `removeAllRanges()` + `addRange(range)` — MEASURED, and it is the
 * cheapest win on the keystroke path this repo has found. The two are equivalent here by
 * construction (every caller of this function places a COLLAPSED caret, so there is no second
 * range for `removeAllRanges` to clear that `collapse` would not), but Blink charges very
 * differently for them: writing the selection forces a synchronous layout of the whole editing
 * host, and the two-call form pays it twice.
 *
 * `commitCost.bench.ts`'s L6 rung, A/B'd by reverting this one line, five runs on an idle machine:
 *
 *   inline 100 marks   addRange 0.332 / 0.334 ms   collapse 0.294 / 0.261 / 0.257 ms   -18.6%
 *   1000 rows         addRange 0.887 / 0.881 ms   collapse 0.717 / 0.697 / 0.731 ms   -19.1%
 *
 * So ~19% off a whole keystroke, and the same figure on two very different document shapes. An
 * earlier reading of ~24% was taken while background agents were loading the machine; ratios
 * survived that, absolutes did not.
 */
export function collapseTo(boundary: CaretBoundary): void {
	const selection = window.getSelection()
	if (!selection) return
	selection.collapse(boundary.node, boundary.offset)
}

/**
 * Build a (possibly non-collapsed) selection range between two DOM boundaries of EITHER shape
 * — text-anchored, parent-anchored, or one of each. The mixed range is the one a document
 * that ends (or begins) with a mark needs, and Chromium takes it: MEASURED, a range from a
 * container child index to a text offset selects the span between them, `toString()` included.
 *
 * The pair is normalized in DOM order first, because `setEnd` before the start COLLAPSES the
 * range rather than spanning backwards. `comparePoint` answers that without a coordinate:
 * both boundaries live under the one editing host, so they are always comparable.
 */
export function placeRangeAcrossBoundaries(a: CaretBoundary, b: CaretBoundary): void {
	const selection = window.getSelection()
	if (!selection) return
	const probe = document.createRange()
	probe.setStart(a.node, a.offset)
	probe.collapse(true)
	const [lo, hi] = probe.comparePoint(b.node, b.offset) >= 0 ? [a, b] : [b, a]
	const range = document.createRange()
	range.setStart(lo.node, lo.offset)
	range.setEnd(hi.node, hi.offset)
	selection.removeAllRanges()
	selection.addRange(range)
}

/**
 * Focus the element's EDITING HOST — the nearest `contenteditable=true` ancestor,
 * itself included — unless focus already sits inside it. Under the one-host topology
 * no token element is focusable, so focusing the element itself is a no-op; a
 * model-initiated placement (no click preceding it) needs the host to take focus.
 */
export function focusEditingHost(element: HTMLElement): void {
	const host = element.closest('[contenteditable="true"]')
	if (host instanceof HTMLElement && !host.contains(document.activeElement)) host.focus()
}