import {expect} from 'vitest'
import {userEvent} from 'vitest/browser'

import {editingHost} from './dom'

function setCaretPosition(element: HTMLElement, offset: number) {
	const range = document.createRange()
	const selection = window.getSelection()

	if (!selection) return

	let currentOffset = 0
	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null)

	let node = walker.nextNode()
	while (node) {
		const nodeLength = node.textContent?.length ?? 0
		// `nodeLength > 0` or a ZERO-LENGTH node satisfies the test at offset 0 and takes the
		// caret. Under Vue that node is the `v-for` fragment anchor a row wrapper opens with —
		// an adapter's own bookkeeping, on no token surface — so the helper would place the
		// caret at a position no click, arrow key or core caret write can reach, and the specs
		// downstream would be measuring the placeholder rather than the row.
		if (nodeLength > 0 && currentOffset + nodeLength >= offset) {
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

/**
 * Focus is asserted on the EDITING HOST, not on `element`: under the single-host topology
 * the container owns `contenteditable`, and text spans, mark roots and block rows are all
 * plain content inside it. The caret — verified below — is what says where we are.
 */
export async function focusAtStart(element: HTMLElement) {
	await userEvent.click(element)
	setCaretPosition(element, 0)
	await expect.element(editingHost(element)).toHaveFocus()

	verifyCaretPosition(element, 0)
}

export async function focusAtEnd(element: HTMLElement) {
	await userEvent.click(element)
	const textLength = element.textContent.length
	setCaretPosition(element, textLength)
	await expect.element(editingHost(element)).toHaveFocus()

	verifyCaretPosition(element, textLength)
}

export async function focusAtOffset(element: HTMLElement, offset: number) {
	await userEvent.click(element)
	setCaretPosition(element, offset)
	await expect.element(editingHost(element)).toHaveFocus()

	verifyCaretPosition(element, offset)
}

/**
 * Move the caret and RETURN, awaiting nothing — the editor hears about it on the next
 * `selectionchange`, which Chromium delivers on a task of its own.
 *
 * That gap is the premise of every spec that uses this: whatever runs before control returns to
 * the event loop sees a DOM caret the editor has not been told about yet. A real browser opens
 * the same gap on its own — a `beforeinput` names the span it is about to edit, and that reading
 * can be newer than the last `selectionchange` — and this is the deterministic spelling of it.
 */
export function moveDomCaret(element: HTMLElement, offset: number) {
	setCaretPosition(element, offset)
	verifyCaretPosition(element, offset)
}

/**
 * ONE TASK. Two things cost one and are asserted across: `selectionchange`, after which the editor
 * holds what the DOM holds and has done whatever it does with that reading, and React's microtask
 * commit of an echoed `onChange`, without which a value read straight after a synthetic gesture is
 * the stale one.
 *
 * It is NOT a blanket "let things settle": the gesture helpers above already await, so a `settle`
 * before an edit measures nothing. Its two callers assert across the boundary — `Base/caret` on
 * what the editor does to a caret once told about it, `Drag` on a document that must NOT have
 * moved.
 */
export const settle = () => new Promise(resolve => setTimeout(resolve, 0))

/** A DOM boundary as a text offset inside `element`. */
function offsetOfBoundary(element: HTMLElement, node: Node, offset: number): number {
	const range = document.createRange()
	range.selectNodeContents(element)
	range.setEnd(node, offset)
	return range.toString().length
}

/**
 * WHERE THE CARET IS, as a text offset inside `element` — `undefined` when there is no range.
 *
 * A TEXT-DOMAIN measurement, which is why a spec asserting a fixed number here cannot fail for a
 * formatting reason. A spec that means to test a layout has to compare it against something the
 * LAYOUT produced — see {@link caretOffsetFromPoint}.
 */
function caretOffsetIn(element: HTMLElement): number | undefined {
	const selection = window.getSelection()
	if (!selection || selection.rangeCount === 0) return undefined

	const {startContainer, startOffset} = selection.getRangeAt(0)
	return offsetOfBoundary(element, startContainer, startOffset)
}

/**
 * WHERE THE LAYOUT PUTS A CARET at a viewport point, as a text offset inside `element`.
 *
 * The editor is not involved: this is the browser's own hit test, so it answers what a click at
 * that point WOULD select. That is what makes it the other half of a display test — compared
 * against the caret AFTER a real click at the same point, it separates "the box moved the click"
 * from "something moved the caret afterwards".
 */
export function caretOffsetFromPoint(element: HTMLElement, x: number, y: number): number | undefined {
	const hit = document.caretRangeFromPoint(x, y)
	if (!hit) return undefined
	return offsetOfBoundary(element, hit.startContainer, hit.startOffset)
}

/** The point `userEvent.click` uses when given an element: the centre of its box. */
export function centreOf(element: HTMLElement): {x: number; y: number} {
	const box = element.getBoundingClientRect()
	return {x: box.left + box.width / 2, y: box.top + box.height / 2}
}

export function verifyCaretPosition(element: HTMLElement, expectedOffset: number) {
	const offset = caretOffsetIn(element)
	expect(offset, 'Caret position not available').not.toBeUndefined()
	expect(offset).toBe(expectedOffset)
}