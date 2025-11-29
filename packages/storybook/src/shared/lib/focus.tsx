import '@testing-library/jest-dom'
import user from '@testing-library/user-event'
import {expect} from 'vitest'

/**
 * Focuses contenteditable element and places caret at start
 */
export async function focusAtStart(element: HTMLElement) {
	await user.pointer({target: element, offset: 0, keys: '[MouseLeft]'})
	expect(element).toHaveFocus()

	verifyCaretPosition(element, 0)
}

/**
 * Focuses contenteditable element and places caret at end
 */
export async function focusAtEnd(element: HTMLElement) {
	await user.pointer({target: element, keys: '[MouseLeft]'})
	expect(element).toHaveFocus()

	const textLength = element.textContent?.length || 0
	verifyCaretPosition(element, textLength)
}

/**
 * Focuses contenteditable element and places caret at specific offset
 */
export async function focusAtOffset(element: HTMLElement, offset: number) {
	await user.pointer({target: element, offset, keys: '[MouseLeft]'})
	expect(element).toHaveFocus()

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

