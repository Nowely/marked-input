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
 * one and target it. Used by `placeAtTextOffset` / `placeRangeAcrossBoundaries` —
 * needs the empty-Text fallback so freshly-mounted empty surfaces still accept
 * a caret.
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

/** THE collapsed placement: one boundary of either shape becomes the whole selection. */
export function collapseTo(boundary: CaretBoundary): void {
	const selection = window.getSelection()
	if (!selection) return
	const range = document.createRange()
	range.setStart(boundary.node, boundary.offset)
	range.collapse(true)
	selection.removeAllRanges()
	selection.addRange(range)
}

/** Place a collapsed caret at a character offset inside a text surface. */
export function placeAtTextOffset(surface: HTMLElement, offset: number): void {
	collapseTo(findTextBoundary(surface, offset))
}

/**
 * Place a collapsed caret at a child index of `parent` — the one-host coordinate for
 * "before/after an atomic child", whose own interior holds no reachable position.
 */
export function placeAtParentBoundary(parent: HTMLElement, childIndex: number): void {
	collapseTo({node: parent, offset: childIndex})
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