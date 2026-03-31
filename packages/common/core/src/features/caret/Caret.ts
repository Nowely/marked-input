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

//TODO refact caret
export class Caret {
	static get isSelectedPosition() {
		const selection = window.getSelection()
		if (!selection) return
		return selection.isCollapsed
	}

	static getCurrentPosition() {
		return window.getSelection()?.anchorOffset ?? 0
	}

	//TODO get span from state?
	static getFocusedSpan() {
		return window.getSelection()?.anchorNode?.textContent ?? ''
	}

	static getSelectedNode() {
		const node = window.getSelection()?.anchorNode
		if (node && document.contains(node)) return node
		throw new Error('Anchor node of selection is not exists!')
	}

	//TODO add the returned type: "{left: CSSProperties["left"], top: CSSProperties["top"]}"?
	static getAbsolutePosition() {
		const rect = window.getSelection()?.getRangeAt(0).getBoundingClientRect()
		if (rect) return {left: rect.left, top: rect.top + rect.height + 1}
		return {left: 0, top: 0}
	}

	/** Returns the raw DOMRect of the current caret position, or null if unavailable. */
	static getCaretRect(): DOMRect | null {
		try {
			const range = window.getSelection()?.getRangeAt(0)
			return range?.getBoundingClientRect() ?? null
		} catch {
			return null
		}
	}

	/**
	 * Returns true if the caret is on the first visual line of the element.
	 */
	static isCaretOnFirstLine(element: HTMLElement): boolean {
		const caretRect = this.getCaretRect()
		if (!caretRect || caretRect.height === 0) return true
		const elRect = element.getBoundingClientRect()
		return caretRect.top < elRect.top + caretRect.height + 2
	}

	/**
	 * Returns true if the caret is on the last visual line of the element.
	 */
	static isCaretOnLastLine(element: HTMLElement): boolean {
		const caretRect = this.getCaretRect()
		if (!caretRect || caretRect.height === 0) return true
		const elRect = element.getBoundingClientRect()
		return caretRect.bottom > elRect.bottom - caretRect.height - 2
	}

	/**
	 * Positions the caret in `element` at the character closest to the given x coordinate.
	 * `y` defaults to the vertical center of the element.
	 */
	static setAtX(element: HTMLElement, x: number, y?: number): void {
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
			// Firefox CaretPosition
			domRange = document.createRange()
			domRange.setStart(caretPos.offsetNode, caretPos.offset)
			domRange.collapse(true)
		} else {
			return
		}

		if (!element.contains(domRange.startContainer)) {
			// Clicked outside: clamp to end
			this.setIndex(element, Infinity)
			return
		}

		sel.removeAllRanges()
		sel.addRange(domRange)
	}

	static trySetIndex(element: HTMLElement, offset: number) {
		try {
			this.setIndex(element, offset)
		} catch (e) {
			console.error(e)
		}
	}

	/**
	 * Sets the caret at character `offset` within `element` by walking text nodes.
	 * Use Infinity to position at the very end of all text.
	 */
	static setIndex(element: HTMLElement, offset: number) {
		const selection = window.getSelection()
		if (!selection) return

		const walker = document.createTreeWalker(element, 4 /* NodeFilter.SHOW_TEXT */)
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
	}

	static getCaretIndex(element: HTMLElement) {
		let position = 0

		const selection = window.getSelection()
		// Check if there is a selection (i.e. cursor in place)
		if (!selection?.rangeCount) return position

		// Store the original range
		const range = selection.getRangeAt(0)
		// Clone the range
		const preCaretRange = range.cloneRange()
		// Select all textual contents from the contenteditable element
		preCaretRange.selectNodeContents(element)
		// And set the range end to the original clicked position
		preCaretRange.setEnd(range.endContainer, range.endOffset)
		// Return the text length from contenteditable start to the range end
		position = preCaretRange.toString().length

		return position
	}

	static setCaretToEnd(element: HTMLElement | null | undefined) {
		if (!element) return
		this.setIndex(element, Infinity)
	}

	static getIndex() {
		const selection = window.getSelection()
		return selection?.anchorOffset ?? NaN
	}

	static setIndex1(offset: number) {
		const selection = window.getSelection()
		if (!selection?.anchorNode || !selection.rangeCount) return

		const range = selection.getRangeAt(0)
		range.setStart(range.startContainer.firstChild ?? range.startContainer, offset)
		range.setEnd(range.startContainer.firstChild ?? range.startContainer, offset)
	}

	setCaretRightTo(element: HTMLElement, offset: number) {
		const selection = window.getSelection()
		const range = selection?.getRangeAt(0)
		range?.setStart(range.endContainer, offset)
		range?.setEnd(range.endContainer, offset)
	}
}