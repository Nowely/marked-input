import type {MarkProps} from '@markput/react'
import {MarkedInput} from '@markput/react'
import {composeStories} from '@storybook/react-vite'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {render} from 'vitest-browser-react'
import {page} from 'vitest/browser'

import * as Stories from './Clipboard.react.stories'

const {Inline, PlainText, Drag, NestedMarkStory} = composeStories(Stories)

function ControlledInlineNoEcho({onChange}: {onChange: (value: string) => void}) {
	return (
		<MarkedInput
			Mark={({value}: MarkProps) => <mark data-testid="mark">{value}</mark>}
			value="hello @[world](1) foo"
			onChange={onChange}
		/>
	)
}

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
	it('partial text selection should set markput MIME with trimmed text', async () => {
		const {container} = await render(<Inline />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement
		const spans = Array.from(root.querySelectorAll<HTMLElement>('[contenteditable="true"]'))

		// Select "ll" from "hello " (the first text span)
		const textNode = firstTextNode(spans[0])!
		setSelection(textNode, 2, textNode, 4)

		const {event, clipboardData} = createCopyEvent(root)
		root.dispatchEvent(event)

		const markput = clipboardData.getData('application/x-markput')
		expect(markput).toBe('ll')

		const plainText = clipboardData.getData('text/plain')
		expect(plainText).toBe('ll')
	})

	it('full text token selection should set markput MIME', async () => {
		const {container} = await render(<Inline />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement
		const spans = Array.from(root.querySelectorAll<HTMLElement>('[contenteditable="true"]'))

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

	it('partial mark selection should set markput MIME with full mark expanded', async () => {
		const {container} = await render(<Inline />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement
		const mark = root.querySelector<HTMLElement>('[data-testid="mark"]')!

		// Select "orl" from the mark text "world"
		const textNode = firstTextNode(mark)!
		setSelection(textNode, 1, textNode, 4)

		const {event, clipboardData} = createCopyEvent(root)
		root.dispatchEvent(event)

		// Partial mark selection → full mark is always expanded in markup
		const markput = clipboardData.getData('application/x-markput')
		expect(markput).toBe('@[world](1)')

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

	it('cross-token partial selection should set markput MIME with trimmed text and full mark', async () => {
		const {container} = await render(<Inline />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement
		const spans = Array.from(root.querySelectorAll<HTMLElement>('[contenteditable="true"]'))

		// Select "lo world fo" — partial first span + full mark + partial last span
		const textNode1 = firstTextNode(spans[0])!
		const textNode2 = firstTextNode(spans[1])!
		setSelection(textNode1, 3, textNode2, 3)

		const {event, clipboardData} = createCopyEvent(root)
		root.dispatchEvent(event)

		// Boundary text tokens trimmed, mark always expanded
		const markput = clipboardData.getData('application/x-markput')
		expect(markput).toBe('lo @[world](1) fo')

		const plainText = clipboardData.getData('text/plain')
		expect(plainText).toBe('lo world fo')
	})

	it('cross-token partial selection paste should reconstruct mark with surrounding text', async () => {
		const {container} = await render(<Inline />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement
		const spans = Array.from(root.querySelectorAll<HTMLElement>('[contenteditable="true"]'))

		// Select "lo world f" — offset 3 in "hello " to offset 2 in " foo"
		const textNode1 = firstTextNode(spans[0])!
		const textNode2 = firstTextNode(spans[1])!
		setSelection(textNode1, 3, textNode2, 2)

		const {event, clipboardData} = createCopyEvent(root)
		root.dispatchEvent(event)

		expect(clipboardData.getData('application/x-markput')).toBe('lo @[world](1) f')

		// Paste at end of last span
		const lastSpan = spans[spans.length - 1]
		const lastText = firstTextNode(lastSpan)!
		lastSpan.focus()
		await new Promise<void>(r => queueMicrotask(r))
		window.getSelection()!.collapse(lastText, lastText.length)

		root.dispatchEvent(new ClipboardEvent('paste', {clipboardData, bubbles: true}))
		const inputRange = document.createRange()
		inputRange.setStart(lastText, lastText.length)
		inputRange.setEnd(lastText, lastText.length)
		const inputEvent = new InputEvent('beforeinput', {
			inputType: 'insertFromPaste',
			bubbles: true,
			cancelable: true,
		})
		Object.defineProperty(inputEvent, 'getTargetRanges', {value: () => [inputRange]})
		Object.defineProperty(inputEvent, 'dataTransfer', {value: clipboardData})
		root.dispatchEvent(inputEvent)

		await new Promise<void>(r => queueMicrotask(r))
		expect(root.querySelectorAll('[data-testid="mark"]').length).toBe(2)
		expect(root.textContent).toBe('hello world foolo world f')
	})

	it('full multi-token selection should set markput MIME', async () => {
		const {container} = await render(<Inline />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement
		const spans = Array.from(root.querySelectorAll<HTMLElement>('[contenteditable="true"]'))

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
		const spans = Array.from(sourceRoot.querySelectorAll<HTMLElement>('[contenteditable="true"]'))
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

		const targetSpan = targetRoot.querySelector<HTMLElement>('[contenteditable="true"]')!
		targetSpan.focus()
		await new Promise<void>(r => queueMicrotask(r))
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

		const markAfter = await page.elementLocator(targetRoot).getByTestId('mark').findElement()
		expect(markAfter.textContent).toBe('world')
	})
})

describe('Clipboard: paste', () => {
	beforeEach(() => {
		// Ensure no stale markup state leaks between tests.
		// With per-container WeakMap scoping (Task 1), this mainly guards against
		// tests that exit early before consuming captured markup.
		window.getSelection()?.removeAllRanges()
	})

	it('pasting markput data should reconstruct the mark in plain text', async () => {
		// Start with plain text — no marks at all
		const {container} = await render(<PlainText />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement

		// Confirm no mark exists initially
		expect(root.querySelector('[data-testid="mark"]')).toBeNull()

		// Find the text span and click it to activate focus
		const span = root.querySelector<HTMLElement>('[contenteditable="true"]')!
		span.focus()
		await new Promise<void>(r => queueMicrotask(r))

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

		const markAfter = await page.elementLocator(root).getByTestId('mark').findElement()
		expect(markAfter.textContent).toBe('world')
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
		const spans = Array.from(root.querySelectorAll<HTMLElement>('[contenteditable="true"]'))
		const lastSpan = spans[spans.length - 1]
		lastSpan.focus()
		await new Promise<void>(r => queueMicrotask(r))
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

		await expect.element(page.elementLocator(root).getByTestId('mark').first()).toBeInTheDocument()
		const marksLocator = page.elementLocator(root).getByTestId('mark')
		expect(marksLocator.length).toBe(2)
		expect(marksLocator.nth(0).element().textContent).toBe('world')
		expect(marksLocator.nth(1).element().textContent).toBe('test')
	})

	it('pasting markup over a selection within a span should replace the selection', async () => {
		const {container} = await render(<PlainText />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement

		const span = root.querySelector<HTMLElement>('[contenteditable="true"]')!
		span.focus()
		await new Promise<void>(r => queueMicrotask(r))

		const textNode = firstTextNode(span)!
		// PlainText story starts with value "abc". Select "b" (offset 1..2).
		setSelection(textNode, 1, textNode, 2)

		const pasteClipboard = new DataTransfer()
		pasteClipboard.setData('text/plain', 'world')
		pasteClipboard.setData('application/x-markput', '@[world](1)')
		root.dispatchEvent(new ClipboardEvent('paste', {clipboardData: pasteClipboard, bubbles: true}))

		const inputRange = document.createRange()
		inputRange.setStart(textNode, 1)
		inputRange.setEnd(textNode, 2) // selection of "b"
		const inputEvent = new InputEvent('beforeinput', {
			inputType: 'insertFromPaste',
			bubbles: true,
			cancelable: true,
		})
		Object.defineProperty(inputEvent, 'getTargetRanges', {value: () => [inputRange]})
		Object.defineProperty(inputEvent, 'dataTransfer', {value: pasteClipboard})
		root.dispatchEvent(inputEvent)

		const mark = await page.elementLocator(root).getByTestId('mark').findElement()
		expect(mark.textContent).toBe('world')
		expect(root.textContent).toBe('aworldc')
	})

	it('keeps controlled text unchanged after paste until value is echoed', async () => {
		const onChange = vi.fn()
		const {container} = await render(<ControlledInlineNoEcho onChange={onChange} />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement
		const spans = Array.from(root.querySelectorAll<HTMLElement>('span[contenteditable]'))
		const lastSpan = spans[spans.length - 1]
		const lastText = firstTextNode(lastSpan)!

		lastSpan.focus()
		await new Promise<void>(r => queueMicrotask(r))
		window.getSelection()!.collapse(lastText, lastText.length)

		const pasteClipboard = new DataTransfer()
		pasteClipboard.setData('text/plain', '!')
		root.dispatchEvent(new ClipboardEvent('paste', {clipboardData: pasteClipboard, bubbles: true}))

		const inputRange = document.createRange()
		inputRange.setStart(lastText, lastText.length)
		inputRange.setEnd(lastText, lastText.length)
		const inputEvent = new InputEvent('beforeinput', {
			inputType: 'insertFromPaste',
			bubbles: true,
			cancelable: true,
		})
		Object.defineProperty(inputEvent, 'getTargetRanges', {value: () => [inputRange]})
		Object.defineProperty(inputEvent, 'dataTransfer', {value: pasteClipboard})
		root.dispatchEvent(inputEvent)

		expect(onChange).toHaveBeenCalled()
		expect(container.textContent).toContain('world')
		expect(lastSpan.textContent).toBe(' foo')
		expect(root.textContent).toBe('hello world foo')
	})

	it('caret should land immediately after pasted mark', async () => {
		const {container} = await render(<Inline />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement
		const mark = root.querySelector<HTMLElement>('[data-testid="mark"]')!
		const spans = Array.from(root.querySelectorAll<HTMLElement>('[contenteditable="true"]'))
		const lastSpan = spans[spans.length - 1]
		const lastText = firstTextNode(lastSpan)! // " foo"

		// Copy the full mark
		const markText = firstTextNode(mark)!
		setSelection(markText, 0, markText, markText.length)
		const copyDt = new DataTransfer()
		root.dispatchEvent(new ClipboardEvent('copy', {clipboardData: copyDt, bubbles: true}))
		expect(copyDt.getData('application/x-markput')).toBe('@[world](1)')

		// Place caret at " |foo" (offset 1 — after the space)
		lastSpan.focus()
		await new Promise<void>(r => queueMicrotask(r))
		window.getSelection()!.collapse(lastText, 1)

		// Paste
		root.dispatchEvent(new ClipboardEvent('paste', {clipboardData: copyDt, bubbles: true}))
		const inputRange = document.createRange()
		inputRange.setStart(lastText, 1)
		inputRange.setEnd(lastText, 1)
		const inputEvent = new InputEvent('beforeinput', {
			inputType: 'insertFromPaste',
			bubbles: true,
			cancelable: true,
		})
		Object.defineProperty(inputEvent, 'getTargetRanges', {value: () => [inputRange]})
		Object.defineProperty(inputEvent, 'dataTransfer', {value: copyDt})
		root.dispatchEvent(inputEvent)

		await new Promise<void>(r => queueMicrotask(r))
		expect(root.querySelectorAll('[data-testid="mark"]').length).toBe(2)
		const sel = window.getSelection()!
		expect(sel.isCollapsed).toBe(true)
		expect(sel.anchorNode?.textContent).toBe('foo')
		expect(sel.anchorOffset).toBe(0)
	})

	it('pasting markput data in drag mode should reconstruct the mark in a block', async () => {
		// Drag story: drag=true, defaultValue="hello\n@[world](1)\nfoo"
		// Each line is a separate draggable block (div > contenteditable span).
		const {container} = await render(<Drag />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement

		// Confirm the editor rendered with existing mark
		expect(root.querySelectorAll('[data-testid="mark"]').length).toBe(1)

		// Focus the first block ("hello") and place caret at end
		const blocks = Array.from(root.querySelectorAll<HTMLElement>('[contenteditable="true"]'))
		expect(blocks.length).toBeGreaterThan(0)
		const firstBlock = blocks[0]
		firstBlock.focus()
		await new Promise<void>(r => queueMicrotask(r))

		const firstBlockText = firstTextNode(firstBlock)
		if (!firstBlockText) throw new Error('no text node in first block')

		window.getSelection()!.collapse(firstBlockText, firstBlockText.length)

		// Paste markup
		const pasteClipboard = new DataTransfer()
		pasteClipboard.setData('text/plain', ' test')
		pasteClipboard.setData('application/x-markput', '@[test](99)')
		root.dispatchEvent(new ClipboardEvent('paste', {clipboardData: pasteClipboard, bubbles: true}))

		const inputRange = document.createRange()
		inputRange.setStart(firstBlockText, firstBlockText.length)
		inputRange.setEnd(firstBlockText, firstBlockText.length)
		const inputEvent = new InputEvent('beforeinput', {
			inputType: 'insertFromPaste',
			bubbles: true,
			cancelable: true,
		})
		Object.defineProperty(inputEvent, 'getTargetRanges', {value: () => [inputRange]})
		Object.defineProperty(inputEvent, 'dataTransfer', {value: pasteClipboard})
		root.dispatchEvent(inputEvent)

		await expect.element(page.getByTestId('mark').first()).toBeInTheDocument()
		const marksLocator = page.getByTestId('mark')
		expect(marksLocator.length).toBe(2)
		expect(marksLocator.nth(0).element().textContent).toBe('test')
	})
})

describe('Clipboard: nested marks', () => {
	beforeEach(() => {
		window.getSelection()?.removeAllRanges()
	})

	it('partial selection within nested mark children should copy correct text', async () => {
		const {container} = await render(<NestedMarkStory />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement
		const mark = root.querySelector<HTMLElement>('[data-testid="mark"]')!

		// NestedMark renders: <mark><strong>wor</strong><em>ld</em></mark>
		// Two text nodes: "wor" and "ld"
		const textNodes = allTextNodes(mark)
		expect(textNodes.length).toBe(2)
		expect(textNodes[0].textContent).toBe('wor')
		expect(textNodes[1].textContent).toBe('ld')

		// Select "rl" — offset 2 in "wor" to offset 1 in "ld"
		setSelection(textNodes[0], 2, textNodes[1], 1)

		const {event, clipboardData} = createCopyEvent(root)
		root.dispatchEvent(event)

		// Full mark is expanded in markput MIME
		expect(clipboardData.getData('application/x-markput')).toBe('@[world](1)')
		// Plain text is the visual selection: "wor"[2:] + "ld"[:1] = "rl"
		expect(clipboardData.getData('text/plain')).toBe('rl')
	})

	it('paste into nested mark should use cumulative offsets', async () => {
		const {container} = await render(<NestedMarkStory />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement
		const mark = root.querySelector<HTMLElement>('[data-testid="mark"]')!

		// Copy the full mark first
		const markTextNodes = allTextNodes(mark)
		setSelection(
			markTextNodes[0],
			0,
			markTextNodes[markTextNodes.length - 1],
			markTextNodes[markTextNodes.length - 1].length
		)
		const copyDt = new DataTransfer()
		root.dispatchEvent(new ClipboardEvent('copy', {clipboardData: copyDt, bubbles: true}))
		expect(copyDt.getData('application/x-markput')).toBe('@[world](1)')

		// Focus the last span " foo" and paste at offset 1
		const spans = Array.from(root.querySelectorAll<HTMLElement>('[contenteditable="true"]'))
		const lastSpan = spans[spans.length - 1]
		const lastText = firstTextNode(lastSpan)!
		lastSpan.focus()
		await new Promise<void>(r => queueMicrotask(r))
		window.getSelection()!.collapse(lastText, 1)

		root.dispatchEvent(new ClipboardEvent('paste', {clipboardData: copyDt, bubbles: true}))
		const inputRange = document.createRange()
		inputRange.setStart(lastText, 1)
		inputRange.setEnd(lastText, 1)
		const inputEvent = new InputEvent('beforeinput', {
			inputType: 'insertFromPaste',
			bubbles: true,
			cancelable: true,
		})
		Object.defineProperty(inputEvent, 'getTargetRanges', {value: () => [inputRange]})
		Object.defineProperty(inputEvent, 'dataTransfer', {value: copyDt})
		root.dispatchEvent(inputEvent)

		await new Promise<void>(r => queueMicrotask(r))
		expect(root.querySelectorAll('[data-testid="mark"]').length).toBe(2)
		expect(root.textContent).toBe('hello world worldfoo')
	})
})

describe('Clipboard: cut', () => {
	beforeEach(() => {
		window.getSelection()?.removeAllRanges()
	})

	function createCutEvent(target: HTMLElement): {event: ClipboardEvent; clipboardData: DataTransfer} {
		const clipboardData = new DataTransfer()
		const event = new ClipboardEvent('cut', {clipboardData, bubbles: true})
		Object.defineProperty(event, 'target', {value: target, writable: false})
		return {event, clipboardData}
	}

	it('does not cut a selection that crosses a registered control', async () => {
		const {container} = await render(<Drag />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement
		const before = root.textContent
		const button = root.querySelector<HTMLButtonElement>('button')!
		const textSurface = root.querySelector<HTMLElement>('[contenteditable="true"]')!
		const textNode = firstTextNode(textSurface)!
		const selection = window.getSelection()!
		const range = document.createRange()
		range.setStart(button, 0)
		range.setEnd(textNode, textNode.length)
		selection.removeAllRanges()
		selection.addRange(range)

		const {event, clipboardData} = createCutEvent(root)
		root.dispatchEvent(event)

		expect(clipboardData.getData('application/x-markput')).toBe('')
		expect(root.textContent).toBe(before)
	})

	it('cut partial text should write to clipboard and remove selection', async () => {
		const {container} = await render(<Inline />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement
		const spans = Array.from(root.querySelectorAll<HTMLElement>('[contenteditable="true"]'))

		// Select "ll" from "hello "
		const textNode = firstTextNode(spans[0])!
		setSelection(textNode, 2, textNode, 4)

		const {event, clipboardData} = createCutEvent(root)
		root.dispatchEvent(event)

		expect(clipboardData.getData('application/x-markput')).toBe('ll')
		expect(clipboardData.getData('text/plain')).toBe('ll')

		await expect.element(page.getByTestId('mark')).toBeInTheDocument()
		expect(root.textContent).toBe('heo world foo')
	})

	it('keeps controlled text unchanged after cut until value is echoed', async () => {
		const onChange = vi.fn()
		const {container} = await render(<ControlledInlineNoEcho onChange={onChange} />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement
		const spans = Array.from(root.querySelectorAll<HTMLElement>('span[contenteditable]'))
		const firstSpan = spans[0]
		const textNode = firstTextNode(firstSpan)!
		setSelection(textNode, 2, textNode, 4)

		const {event, clipboardData} = createCutEvent(root)
		root.dispatchEvent(event)

		expect(clipboardData.getData('application/x-markput')).toBe('ll')
		expect(onChange).toHaveBeenCalled()
		expect(container.textContent).toContain('world')
		expect(firstSpan.textContent).toBe('hello ')
		expect(root.textContent).toBe('hello world foo')
	})

	it('cut across tokens should write trimmed markup and remove selection', async () => {
		const {container} = await render(<Inline />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement
		const spans = Array.from(root.querySelectorAll<HTMLElement>('[contenteditable="true"]'))

		// Select "lo world fo" — partial first span + full mark + partial last span
		const textNode1 = firstTextNode(spans[0])!
		const textNode2 = firstTextNode(spans[1])!
		setSelection(textNode1, 3, textNode2, 3)

		const {event, clipboardData} = createCutEvent(root)
		root.dispatchEvent(event)

		expect(clipboardData.getData('application/x-markput')).toBe('lo @[world](1) fo')

		await expect.element(page.getByText('helo')).toBeInTheDocument()
	})

	it('cut full mark should remove the mark', async () => {
		const {container} = await render(<Inline />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement
		const mark = root.querySelector<HTMLElement>('[data-testid="mark"]')!

		// Select the entire mark
		const textNode = firstTextNode(mark)!
		setSelection(textNode, 0, textNode, textNode.length)

		const {event, clipboardData} = createCutEvent(root)
		root.dispatchEvent(event)

		expect(clipboardData.getData('application/x-markput')).toBe('@[world](1)')

		await expect.element(page.getByTestId('mark')).not.toBeInTheDocument()
		expect(root.textContent).toBe('hello  foo')
	})

	it('cut all content should clear the editor', async () => {
		const {container} = await render(<Inline />)
		// oxlint-disable-next-line no-unsafe-type-assertion -- firstElementChild is always HTMLElement
		const root = container.firstElementChild as HTMLElement
		const spans = Array.from(root.querySelectorAll<HTMLElement>('[contenteditable="true"]'))

		// Select from start of first span to end of last span
		const textNode1 = firstTextNode(spans[0])!
		const textNode2 = firstTextNode(spans[1])!
		setSelection(textNode1, 0, textNode2, textNode2.length)

		const {event, clipboardData} = createCutEvent(root)
		root.dispatchEvent(event)

		expect(clipboardData.getData('application/x-markput')).toBe('hello @[world](1) foo')

		await expect.element(page.getByTestId('mark')).not.toBeInTheDocument()
	})
})