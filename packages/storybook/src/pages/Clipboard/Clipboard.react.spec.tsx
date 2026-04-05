import {composeStories} from '@storybook/react-vite'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-react'

import * as Stories from './Clipboard.react.stories'

const {Inline, PlainText} = composeStories(Stories)

/**
 * Create a ClipboardEvent with a mock DataTransfer for testing copy/paste handlers.
 */
function createCopyEvent(target: HTMLElement): {event: ClipboardEvent; clipboardData: DataTransfer} {
	const clipboardData = new DataTransfer()
	const event = new ClipboardEvent('copy', {clipboardData, bubbles: true})
	Object.defineProperty(event, 'target', {value: target, writable: false})
	return {event, clipboardData}
}

/**
 * Simulate setting a text selection within a text node.
 * Returns the range for verification.
 */
function setSelection(startNode: Node, startOffset: number, endNode: Node, endOffset: number): Range {
	const sel = window.getSelection()!
	const range = document.createRange()
	range.setStart(startNode, startOffset)
	range.setEnd(endNode, endOffset)
	sel.removeAllRanges()
	sel.addRange(range)
	return range
}

/**
 * Find the first text node inside an element.
 */
function firstTextNode(el: Element): Text | null {
	const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
	// oxlint-disable-next-line no-unsafe-type-assertion -- nodeType === 3 guarantees Text
	return (walker.nextNode() as Text | null) ?? null
}

/**
 * Collect all text nodes in document order within an element.
 */
function allTextNodes(el: Element): Text[] {
	const result: Text[] = []
	const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
	while (walker.nextNode()) {
		// oxlint-disable-next-line no-unsafe-type-assertion -- SHOW_TEXT guarantees Text
		result.push(walker.currentNode as Text)
	}
	return result
}

describe('Clipboard: copy', () => {
	it('partial text selection should NOT set markput MIME', async () => {
		const {container} = await render(<Inline />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement
		const spans = Array.from(root.querySelectorAll<HTMLElement>('span'))

		// Select "ll" from "hello " (the first text span)
		const textNode = firstTextNode(spans[0])!
		setSelection(textNode, 2, textNode, 4)

		const {event, clipboardData} = createCopyEvent(root)
		root.dispatchEvent(event)

		const markput = clipboardData.getData('application/x-markput')
		expect(markput).toBe('')

		const plainText = clipboardData.getData('text/plain')
		expect(plainText).toBe('ll')
	})

	it('full text token selection should set markput MIME', async () => {
		const {container} = await render(<Inline />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement
		const spans = Array.from(root.querySelectorAll<HTMLElement>('span'))

		// Select the entire first text span "hello "
		const textNode = firstTextNode(spans[0])!
		setSelection(textNode, 0, textNode, textNode.length)

		const {event, clipboardData} = createCopyEvent(root)
		root.dispatchEvent(event)

		const markput = clipboardData.getData('application/x-markput')
		expect(markput).toBe('hello ')

		const plainText = clipboardData.getData('text/plain')
		expect(plainText).toBe('hello ')
	})

	it('partial mark selection should NOT set markput MIME', async () => {
		const {container} = await render(<Inline />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement
		const mark = root.querySelector<HTMLElement>('[data-testid="mark"]')!

		// Select "orl" from the mark text "world"
		const textNode = firstTextNode(mark)!
		setSelection(textNode, 1, textNode, 4)

		const {event, clipboardData} = createCopyEvent(root)
		root.dispatchEvent(event)

		const markput = clipboardData.getData('application/x-markput')
		expect(markput).toBe('')

		const plainText = clipboardData.getData('text/plain')
		expect(plainText).toBe('orl')
	})

	it('full mark selection should set markput MIME with complete markup', async () => {
		const {container} = await render(<Inline />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement
		const mark = root.querySelector<HTMLElement>('[data-testid="mark"]')!

		// Select the entire mark
		const textNode = firstTextNode(mark)!
		setSelection(textNode, 0, textNode, textNode.length)

		const {event, clipboardData} = createCopyEvent(root)
		root.dispatchEvent(event)

		const markput = clipboardData.getData('application/x-markput')
		expect(markput).toBe('@[world](1)')

		const plainText = clipboardData.getData('text/plain')
		expect(plainText).toBe('world')
	})

	it('cross-token partial selection should NOT set markput MIME', async () => {
		const {container} = await render(<Inline />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement
		const spans = Array.from(root.querySelectorAll<HTMLElement>('span'))

		// Select from middle of first span to middle of last span
		// "llo @[world](1) fo"
		const textNode1 = firstTextNode(spans[0])!
		const textNode2 = firstTextNode(spans[1])!
		setSelection(textNode1, 3, textNode2, 3)

		const {event, clipboardData} = createCopyEvent(root)
		root.dispatchEvent(event)

		const markput = clipboardData.getData('application/x-markput')
		expect(markput).toBe('')

		const plainText = clipboardData.getData('text/plain')
		expect(plainText).toBe('lo world fo')
	})

	it('full multi-token selection should set markput MIME', async () => {
		const {container} = await render(<Inline />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement
		const spans = Array.from(root.querySelectorAll<HTMLElement>('span'))

		// Select from start of first span to end of last span
		const textNode1 = firstTextNode(spans[0])!
		const textNode2 = firstTextNode(spans[1])!
		setSelection(textNode1, 0, textNode2, textNode2.length)

		const {event, clipboardData} = createCopyEvent(root)
		root.dispatchEvent(event)

		const markput = clipboardData.getData('application/x-markput')
		expect(markput).toBe('hello @[world](1) foo')
	})

	it('selecting text + mark via drag should set markput MIME', async () => {
		const {container} = await render(<Inline />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement

		// Simulate a browser drag selection that spans from "hello " through the mark "world"
		// In the real browser, the range starts at the first span's text node and ends at the
		// mark's text node (or the element boundary).
		// DOM: container > span[0]("hello "), mark[1]("world"), span[2](" foo")
		const textNodes = allTextNodes(root)
		// textNodes: ["hello ", "world", " foo"]
		expect(textNodes.length).toBe(3)

		// Select from "hello " start to "world" end (span + mark)
		setSelection(textNodes[0], 0, textNodes[1], textNodes[1].length)

		const {event, clipboardData} = createCopyEvent(root)
		root.dispatchEvent(event)

		const markput = clipboardData.getData('application/x-markput')
		expect(markput).toBe('hello @[world](1)')

		const plainText = clipboardData.getData('text/plain')
		expect(plainText).toBe('hello world')
	})

	it('copy-paste round-trip: select all, copy, paste into plain text should reconstruct marks', async () => {
		// Step 1: Render source editor with a mark
		const {container: sourceContainer} = await render(<Inline />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const sourceRoot = sourceContainer.firstElementChild as HTMLElement

		// Select all: from start of first span to end of last span
		const spans = Array.from(sourceRoot.querySelectorAll<HTMLElement>('span'))
		const textNode1 = firstTextNode(spans[0])!
		const textNode2 = firstTextNode(spans[1])!
		setSelection(textNode1, 0, textNode2, textNode2.length)

		// Copy from source
		const copyClipboardData = new DataTransfer()
		const copyEvent = new ClipboardEvent('copy', {clipboardData: copyClipboardData, bubbles: true})
		Object.defineProperty(copyEvent, 'target', {value: sourceRoot, writable: false})
		sourceRoot.dispatchEvent(copyEvent)

		// Verify markput was captured
		const markput = copyClipboardData.getData('application/x-markput')
		expect(markput).toBe('hello @[world](1) foo')

		// Step 2: Render target editor (plain text, no marks)
		const {container: targetContainer} = await render(<PlainText />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const targetRoot = targetContainer.firstElementChild as HTMLElement
		expect(targetRoot.querySelector('[data-testid="mark"]')).toBeNull()

		const targetSpan = targetRoot.querySelector<HTMLElement>('span')!
		targetSpan.focus()
		await new Promise(r => queueMicrotask(r))
		expect(document.activeElement).toBe(targetSpan)

		const targetTextNode = firstTextNode(targetSpan)!
		const sel = window.getSelection()!
		sel.collapse(targetTextNode, 0)

		// Paste into target
		const pasteClipboard = new DataTransfer()
		pasteClipboard.setData('text/plain', copyClipboardData.getData('text/plain'))
		pasteClipboard.setData('application/x-markput', markput)
		const pasteEvent = new ClipboardEvent('paste', {clipboardData: pasteClipboard, bubbles: true})
		targetRoot.dispatchEvent(pasteEvent)

		const inputRanges = [document.createRange()]
		inputRanges[0].setStart(targetTextNode, 0)
		inputRanges[0].setEnd(targetTextNode, 0)
		const inputEvent = new InputEvent('beforeinput', {
			inputType: 'insertFromPaste',
			bubbles: true,
			cancelable: true,
		})
		Object.defineProperty(inputEvent, 'getTargetRanges', {value: () => inputRanges})
		Object.defineProperty(inputEvent, 'dataTransfer', {value: pasteClipboard})
		targetRoot.dispatchEvent(inputEvent)

		// Wait for React re-render
		await new Promise(r => setTimeout(r, 50))

		// Verify mark was reconstructed in target
		const markAfter = targetRoot.querySelector<HTMLElement>('[data-testid="mark"]')
		expect(markAfter).not.toBeNull()
		expect(markAfter?.textContent).toBe('world')
	})
})

describe('Clipboard: paste', () => {
	it('pasting markput data should reconstruct the mark in plain text', async () => {
		// Start with plain text — no marks at all
		const {container} = await render(<PlainText />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement

		// Confirm no mark exists initially
		expect(root.querySelector('[data-testid="mark"]')).toBeNull()

		// Find the text span and click it to activate focus
		const span = root.querySelector<HTMLElement>('span')!
		span.focus()
		await new Promise(r => queueMicrotask(r))

		// Confirm focus is set
		expect(document.activeElement).toBe(span)

		// Place caret at start of the span's text node
		const textNode = firstTextNode(span)!
		const sel = window.getSelection()!
		sel.collapse(textNode, 0)

		// Simulate paste event with markput data
		const pasteClipboard = new DataTransfer()
		pasteClipboard.setData('text/plain', 'hello world foo')
		pasteClipboard.setData('application/x-markput', 'hello @[world](1) foo')
		const pasteEvent = new ClipboardEvent('paste', {clipboardData: pasteClipboard, bubbles: true})
		root.dispatchEvent(pasteEvent)

		// Simulate beforeinput (insertFromPaste)
		const inputRanges = [document.createRange()]
		inputRanges[0].setStart(textNode, 0)
		inputRanges[0].setEnd(textNode, 0)
		const inputEvent = new InputEvent('beforeinput', {
			inputType: 'insertFromPaste',
			bubbles: true,
			cancelable: true,
		})
		Object.defineProperty(inputEvent, 'getTargetRanges', {value: () => inputRanges})
		Object.defineProperty(inputEvent, 'dataTransfer', {value: pasteClipboard})
		root.dispatchEvent(inputEvent)

		// Wait for React to re-render with the new value
		await new Promise(r => setTimeout(r, 50))

		// Verify the mark was reconstructed
		const markAfter = root.querySelector<HTMLElement>('[data-testid="mark"]')
		expect(markAfter).not.toBeNull()
		expect(markAfter?.textContent).toBe('world')
	})

	it('pasting markput data into uncontrolled editor should reconstruct the mark', async () => {
		// Use Inline story (defaultValue, no onChange — uncontrolled mode)
		const {container} = await render(<Inline />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement

		// The Inline story already has a mark, confirm it
		const marksBefore = root.querySelectorAll<HTMLElement>('[data-testid="mark"]')
		expect(marksBefore.length).toBe(1)

		// Focus the last span " foo" and place caret at end
		const spans = Array.from(root.querySelectorAll<HTMLElement>('span'))
		const lastSpan = spans[spans.length - 1]
		lastSpan.focus()
		await new Promise(r => queueMicrotask(r))
		expect(document.activeElement).toBe(lastSpan)

		const textNode = firstTextNode(lastSpan)!
		const sel = window.getSelection()!
		sel.collapse(textNode, textNode.length)

		// Paste additional markput data at the end
		const pasteClipboard = new DataTransfer()
		pasteClipboard.setData('text/plain', ' test')
		pasteClipboard.setData('application/x-markput', '@[test](2)')
		const pasteEvent = new ClipboardEvent('paste', {clipboardData: pasteClipboard, bubbles: true})
		root.dispatchEvent(pasteEvent)

		const inputRanges = [document.createRange()]
		inputRanges[0].setStart(textNode, textNode.length)
		inputRanges[0].setEnd(textNode, textNode.length)
		const inputEvent = new InputEvent('beforeinput', {
			inputType: 'insertFromPaste',
			bubbles: true,
			cancelable: true,
		})
		Object.defineProperty(inputEvent, 'getTargetRanges', {value: () => inputRanges})
		Object.defineProperty(inputEvent, 'dataTransfer', {value: pasteClipboard})
		root.dispatchEvent(inputEvent)

		// Wait for React to re-render
		await new Promise(r => setTimeout(r, 50))

		// Should now have two marks: the original "world" + the pasted "test"
		const marksAfter = root.querySelectorAll<HTMLElement>('[data-testid="mark"]')
		expect(marksAfter.length).toBe(2)
		expect(marksAfter[0]?.textContent).toBe('world')
		expect(marksAfter[1]?.textContent).toBe('test')
	})
})