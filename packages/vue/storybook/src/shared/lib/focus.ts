import {expect} from 'vitest'
import {userEvent} from 'vitest/browser'

function setCaretPosition(element: HTMLElement, offset: number) {
	const range = document.createRange()
	const selection = window.getSelection()

	if (!selection) return

	let currentOffset = 0
	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null)

	let node = walker.nextNode()
	while (node) {
		const nodeLength = node.textContent?.length ?? 0
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

	range.selectNodeContents(element)
	range.collapse(false)
	selection.removeAllRanges()
	selection.addRange(range)
}

export async function focusAtStart(element: HTMLElement) {
	await userEvent.click(element)
	setCaretPosition(element, 0)
	await expect.element(element).toHaveFocus()

	verifyCaretPosition(element, 0)
}

export async function focusAtEnd(element: HTMLElement) {
	await userEvent.click(element)
	const textLength = element.textContent?.length ?? 0
	setCaretPosition(element, textLength)
	await expect.element(element).toHaveFocus()

	verifyCaretPosition(element, textLength)
}

export async function focusAtOffset(element: HTMLElement, offset: number) {
	await userEvent.click(element)
	setCaretPosition(element, offset)
	await expect.element(element).toHaveFocus()

	verifyCaretPosition(element, offset)
}

export function verifyCaretPosition(element: HTMLElement, expectedOffset: number) {
	const position = getCaretPosition()
	expect(position, 'Caret position not available').not.toBeNull()
	if (!position) return

	const length = measureTextLength(element, position.node, position.offset)
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

	function measureTextLength(containerElement: HTMLElement, endNode: Node, endOffset: number) {
		const range = document.createRange()
		range.selectNodeContents(containerElement)
		range.setEnd(endNode, endOffset)
		return range.toString().length
	}
}