import {userEvent} from 'vitest/browser'
import {expect} from 'vitest'

/**
 * Sets caret position in a contenteditable element
 */
function setCaretPosition(element: HTMLElement, offset: number) {
	const range = document.createRange()
	const selection = window.getSelection()

	if (!selection) return

	// Find the text node and offset within it
	let currentOffset = 0
	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null)

	let node = walker.nextNode()
	while (node) {
		const nodeLength = node.textContent?.length || 0
		if (currentOffset + nodeLength >= offset) {
			range.setStart(node, offset - currentOffset)
			range.collapse(true)
			selection.removeAllRanges()
			selection.addRange(range)
			return
		}
		currentOffset += nodeLength
		node = walker.nextNode()
	}

	// If offset is beyond content, place at end
	range.selectNodeContents(element)
	range.collapse(false)
	selection.removeAllRanges()
	selection.addRange(range)
}

/**
 * Focuses contenteditable element and places caret at start
 */
export async function focusAtStart(element: HTMLElement) {
	await userEvent.click(element)
	setCaretPosition(element, 0)
	await expect.element(element).toHaveFocus()

	verifyCaretPosition(element, 0)
}

/**
 * Focuses contenteditable element and places caret at end
 */
export async function focusAtEnd(element: HTMLElement) {
	await userEvent.click(element)
	const textLength = element.textContent?.length || 0
	setCaretPosition(element, textLength)
	await expect.element(element).toHaveFocus()

	verifyCaretPosition(element, textLength)
}

/**
 * Focuses contenteditable element and places caret at specific offset
 */
export async function focusAtOffset(element: HTMLElement, offset: number) {
	await userEvent.click(element)
	setCaretPosition(element, offset)
	await expect.element(element).toHaveFocus()

	verifyCaretPosition(element, offset)
}

/**
 * Verifies caret position in a contenteditable element by comparing
 * the actual position to the expected character offset.
 *
 * @param element - Contenteditable HTML element
 * @param expectedOffset - Expected caret position (character offset)
 */
function verifyCaretPosition(element: HTMLElement, expectedOffset: number) {
	const position = getCaretPosition()
	expect(position, 'Caret position not available').not.toBeNull()

	const length = measureTextLength(element, position!.node, position!.offset)
	expect(length).toBe(expectedOffset)

	function getCaretPosition() {
		const selection = window.getSelection()
		if (!selection || selection.rangeCount === 0) return null

		const range = selection.getRangeAt(0)
		return {
			node: range.startContainer,
			offset: range.startOffset,
		}
	}

	function measureTextLength(element: HTMLElement, endNode: Node, endOffset: number) {
		const range = document.createRange()
		range.selectNodeContents(element)
		range.setEnd(endNode, endOffset)
		return range.toString().length
	}
}
