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
 *   block 1000 rows    addRange 0.887 / 0.881 ms   collapse 0.717 / 0.697 / 0.731 ms   -19.1%
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