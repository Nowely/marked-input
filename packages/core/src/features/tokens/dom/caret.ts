import {nextText} from '../../../shared/checkers'

/** Firefox-only CaretPosition (absent from TypeScript DOM lib) */
interface CaretPosition {
	readonly offsetNode: Node
	readonly offset: number
}

/** Non-standard document caret APIs absent from TypeScript DOM lib */
interface DocumentWithCaretFromPoint {
	caretRangeFromPoint?(x: number, y: number): Range | null
	caretPositionFromPoint?(x: number, y: number): CaretPosition | null
}

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

export function isOnFirstLine(element: HTMLElement): boolean {
	const caretRect = getRect()
	if (!caretRect || caretRect.height === 0) return true
	const elRect = element.getBoundingClientRect()
	return caretRect.top < elRect.top + caretRect.height + 2
}

export function isOnLastLine(element: HTMLElement): boolean {
	const caretRect = getRect()
	if (!caretRect || caretRect.height === 0) return true
	const elRect = element.getBoundingClientRect()
	return caretRect.bottom > elRect.bottom - caretRect.height - 2
}

function setAtElement(element: HTMLElement): void {
	try {
		const selection = window.getSelection()
		if (!selection) return
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
		let node = nextText(walker)
		if (!node) return
		for (;;) {
			const next = nextText(walker)
			if (!next) {
				const range = document.createRange()
				range.setStart(node, node.length)
				range.collapse(true)
				selection.removeAllRanges()
				selection.addRange(range)
				return
			}
			node = next
		}
	} catch (e) {
		console.error(e)
	}
}

export function setAtX(element: HTMLElement, x: number, y?: number): void {
	const elRect = element.getBoundingClientRect()
	const targetY = y ?? elRect.top + elRect.height / 2
	// oxlint-disable-next-line no-unsafe-type-assertion -- non-standard DOM APIs not in TS lib
	const caretDoc = document as unknown as DocumentWithCaretFromPoint
	const caretPos = caretDoc.caretRangeFromPoint?.(x, targetY) ?? caretDoc.caretPositionFromPoint?.(x, targetY)
	if (!caretPos) return
	const sel = window.getSelection()
	if (!sel) return
	let domRange: Range
	if (caretPos instanceof Range) {
		domRange = caretPos
	} else if ('offsetNode' in caretPos) {
		domRange = document.createRange()
		domRange.setStart(caretPos.offsetNode, caretPos.offset)
		domRange.collapse(true)
	} else {
		return
	}
	if (!element.contains(domRange.startContainer)) {
		setAtElement(element)
		return
	}
	sel.removeAllRanges()
	sel.addRange(domRange)
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

/** Place a collapsed caret at the start or end of an element's child list. */
export function placeAtChildBoundary(element: HTMLElement, side: 'start' | 'end'): void {
	const selection = window.getSelection()
	if (!selection) return
	const range = document.createRange()
	const childIndex = side === 'end' ? element.childNodes.length : 0
	range.setStart(element, childIndex)
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

/** Focus `element` only when it is not already the active element. */
export function focusIfNeeded(element: HTMLElement): void {
	if (document.activeElement !== element) element.focus()
}