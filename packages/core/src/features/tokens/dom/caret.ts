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
 * Resolve a character offset within a structural text surface to a concrete
 * (Text, offset) pair. If the surface contains no Text node, append an empty
 * one and target it. Used by `placeAtTextOffset` / `placeRangeAcrossSurfaces` —
 * needs the empty-Text fallback so freshly-mounted empty surfaces still accept
 * a caret.
 */
function findTextBoundary(surface: HTMLElement, offset: number): {node: Text; offset: number} {
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

/** Place a collapsed caret at a character offset inside a text surface. */
export function placeAtTextOffset(surface: HTMLElement, offset: number): void {
	const selection = window.getSelection()
	if (!selection) return
	const {node, offset: nodeOffset} = findTextBoundary(surface, offset)
	const range = document.createRange()
	range.setStart(node, nodeOffset)
	range.collapse(true)
	selection.removeAllRanges()
	selection.addRange(range)
}

/**
 * Place a collapsed caret at a child index of `parent` — the one-host coordinate for
 * "before/after an atomic child", whose own interior holds no reachable position.
 */
export function placeAtParentBoundary(parent: HTMLElement, childIndex: number): void {
	const selection = window.getSelection()
	if (!selection) return
	const range = document.createRange()
	range.setStart(parent, childIndex)
	range.collapse(true)
	selection.removeAllRanges()
	selection.addRange(range)
}

/** Build a (possibly non-collapsed) selection range across two text surfaces. */
export function placeRangeAcrossSurfaces(
	start: {element: HTMLElement; offset: number},
	end: {element: HTMLElement; offset: number}
): void {
	const selection = window.getSelection()
	if (!selection) return
	const startBoundary = findTextBoundary(start.element, start.offset)
	const endBoundary = findTextBoundary(end.element, end.offset)
	const range = document.createRange()
	range.setStart(startBoundary.node, startBoundary.offset)
	range.setEnd(endBoundary.node, endBoundary.offset)
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