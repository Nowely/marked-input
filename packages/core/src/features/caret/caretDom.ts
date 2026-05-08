import {nextText} from '../../shared/checkers'

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
	let position = 0
	const selection = window.getSelection()
	if (!selection?.rangeCount) return position
	const range = selection.getRangeAt(0)
	const preCaretRange = range.cloneRange()
	preCaretRange.selectNodeContents(element)
	preCaretRange.setEnd(range.endContainer, range.endOffset)
	position = preCaretRange.toString().length
	return position
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

export function setAtElement(element: HTMLElement, offset: number): void {
	try {
		const selection = window.getSelection()
		if (!selection) return
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
		let node = nextText(walker)
		if (!node) return
		let remaining = isFinite(offset) ? Math.max(0, offset) : Infinity
		for (;;) {
			const next = nextText(walker)
			if (!next || remaining <= node.length) {
				const charOffset = isFinite(remaining) ? Math.min(remaining, node.length) : node.length
				const range = document.createRange()
				range.setStart(node, charOffset)
				range.collapse(true)
				selection.removeAllRanges()
				selection.addRange(range)
				return
			}
			remaining -= node.length
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
		setAtElement(element, Infinity)
		return
	}
	sel.removeAllRanges()
	sel.addRange(domRange)
}