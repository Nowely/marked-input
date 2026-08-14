import {beforeEach, describe, expect, it, vi} from 'vitest'
import {page} from 'vitest/browser'

import {textSurfaces} from '../../shared/lib/dom'
import {composePage, mount} from '../../shared/lib/page'
import * as ClipboardStories from './Clipboard.stories'

const {Inline, PlainText, Drag, NestedMarkStory} = composePage(ClipboardStories)

/** The `Inline` value again, driven as a CONTROLLED field whose `onChange` is never echoed. */
const CONTROLLED_VALUE = 'hello @[world](1) foo'

/** One microtask turn, for the adapters that apply a paste after the current task. */
const flush = () => new Promise<void>(resolve => queueMicrotask(resolve))

/** Dispatches a copy/cut carrying a mock DataTransfer, and hands the DataTransfer back. */
function dispatchClipboard(type: 'copy' | 'cut', host: HTMLElement): DataTransfer {
	const clipboardData = new DataTransfer()
	const event = new ClipboardEvent(type, {clipboardData, bubbles: true})
	Object.defineProperty(event, 'target', {value: host, writable: false})
	host.dispatchEvent(event)
	return clipboardData
}

/**
 * The paste sequence a browser produces: `paste` carries the data, and the `beforeinput` that
 * follows carries the target range — which is the position the editor actually inserts at.
 */
function pasteAt(
	host: HTMLElement,
	clipboardData: DataTransfer,
	startNode: Node,
	startOffset: number,
	endNode: Node = startNode,
	endOffset: number = startOffset
): void {
	host.dispatchEvent(new ClipboardEvent('paste', {clipboardData, bubbles: true}))

	const targetRange = document.createRange()
	targetRange.setStart(startNode, startOffset)
	targetRange.setEnd(endNode, endOffset)
	const inputEvent = new InputEvent('beforeinput', {inputType: 'insertFromPaste', bubbles: true, cancelable: true})
	Object.defineProperty(inputEvent, 'getTargetRanges', {value: () => [targetRange]})
	Object.defineProperty(inputEvent, 'dataTransfer', {value: clipboardData})
	host.dispatchEvent(inputEvent)
}

/** Sets a text selection, and returns the range for verification. */
function setSelection(startNode: Node, startOffset: number, endNode: Node, endOffset: number): Range {
	const sel = window.getSelection()!
	const range = document.createRange()
	range.setStart(startNode, startOffset)
	range.setEnd(endNode, endOffset)
	sel.removeAllRanges()
	sel.addRange(range)
	return range
}

/** The first text node inside an element. */
function firstTextNode(el: Element): Text | null {
	const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
	// oxlint-disable-next-line no-unsafe-type-assertion -- nodeType === 3 guarantees Text
	return (walker.nextNode() as Text | null) ?? null
}

/** Every text node of an element, in document order. */
function allTextNodes(el: Element): Text[] {
	const result: Text[] = []
	const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
	while (walker.nextNode()) {
		// oxlint-disable-next-line no-unsafe-type-assertion -- SHOW_TEXT guarantees Text
		result.push(walker.currentNode as Text)
	}
	return result
}

/**
 * The `text/html` entry parsed back into a detached element. Anything the frameworks render
 * is asserted THROUGH this and never as a raw string: the entry is framework-rendered
 * `innerHTML`, so React and Vue are free to differ in attribute order and in attributes no
 * assertion here names.
 */
function parseHtml(html: string): HTMLElement {
	const holder = document.createElement('div')
	holder.innerHTML = html
	return holder
}

/** The element children of a parsed `text/html` entry, as `[tagName, textContent]` pairs. */
function shapeOf(fragment: HTMLElement): [string, string][] {
	return Array.from(fragment.children).map((child): [string, string] => [child.tagName, child.textContent])
}

describe('Clipboard: copy', () => {
	it('partial text selection should set markput MIME with trimmed text', async () => {
		const {host} = await mount(Inline)
		const spans = textSurfaces(host)

		// Select "ll" from "hello " (the first text span)
		const textNode = firstTextNode(spans[0])!
		setSelection(textNode, 2, textNode, 4)

		const clipboardData = dispatchClipboard('copy', host)

		expect(clipboardData.getData('application/x-markput')).toBe('ll')
		expect(clipboardData.getData('text/plain')).toBe('ll')
		// Both ends sit in ONE text node, so the clone carries no element and the entry is
		// exact in either framework.
		expect(clipboardData.getData('text/html')).toBe('ll')
	})

	it('full text token selection should set markput MIME', async () => {
		const {host} = await mount(Inline)
		const spans = textSurfaces(host)

		// Select the entire first text span "hello "
		const textNode = firstTextNode(spans[0])!
		setSelection(textNode, 0, textNode, textNode.length)

		const clipboardData = dispatchClipboard('copy', host)

		expect(clipboardData.getData('application/x-markput')).toBe('hello ')
		expect(clipboardData.getData('text/plain')).toBe('hello ')
		// The span is covered by its text node, not by the range, so the surface itself is
		// still not cloned.
		expect(clipboardData.getData('text/html')).toBe('hello ')
	})

	it('partial mark selection should set markput MIME with full mark expanded', async () => {
		const {host} = await mount(Inline)
		const mark = host.querySelector('mark')!

		// Select "orl" from the mark text "world"
		const textNode = firstTextNode(mark)!
		setSelection(textNode, 1, textNode, 4)

		const clipboardData = dispatchClipboard('copy', host)

		// Partial mark selection → full mark is always expanded in markup
		expect(clipboardData.getData('application/x-markput')).toBe('@[world](1)')
		expect(clipboardData.getData('text/plain')).toBe('orl')
		// text/html follows the VISUAL selection, so it does NOT expand the mark the way the
		// markput entry does.
		expect(clipboardData.getData('text/html')).toBe('orl')
	})

	it('full mark selection should set markput MIME with complete markup', async () => {
		const {host} = await mount(Inline)
		const mark = host.querySelector('mark')!

		// Select the entire mark
		const textNode = firstTextNode(mark)!
		setSelection(textNode, 0, textNode, textNode.length)

		const clipboardData = dispatchClipboard('copy', host)

		expect(clipboardData.getData('application/x-markput')).toBe('@[world](1)')
		expect(clipboardData.getData('text/plain')).toBe('world')
		// The range ends INSIDE the mark's text node, so the `<mark>` element is outside it and
		// the entry is the bare text — the whole mark reaches the clipboard only via markput.
		expect(clipboardData.getData('text/html')).toBe('world')
	})

	it('cross-token partial selection should set markput MIME with trimmed text and full mark', async () => {
		const {host} = await mount(Inline)
		const spans = textSurfaces(host)

		// Select "lo world fo" — partial first span + full mark + partial last span
		const textNode1 = firstTextNode(spans[0])!
		const textNode2 = firstTextNode(spans[1])!
		setSelection(textNode1, 3, textNode2, 3)

		const clipboardData = dispatchClipboard('copy', host)

		// Boundary text tokens trimmed, mark always expanded
		expect(clipboardData.getData('application/x-markput')).toBe('lo @[world](1) fo')
		expect(clipboardData.getData('text/plain')).toBe('lo world fo')

		// Here the mark element IS inside the range: partial surfaces clone as trimmed spans
		// around a whole mark.
		const fragment = parseHtml(clipboardData.getData('text/html'))
		expect(shapeOf(fragment)).toEqual([
			['SPAN', 'lo '],
			['MARK', 'world'],
			['SPAN', ' fo'],
		])
		// Written by core's editable state rather than by either adapter, so it is the one
		// attribute both frameworks are bound to carry.
		expect(fragment.querySelector('mark')!.getAttribute('contenteditable')).toBe('false')
	})

	it('cross-token partial selection paste should reconstruct mark with surrounding text', async () => {
		const {host} = await mount(Inline)
		const spans = textSurfaces(host)

		// Select "lo world f" — offset 3 in "hello " to offset 2 in " foo"
		const textNode1 = firstTextNode(spans[0])!
		const textNode2 = firstTextNode(spans[1])!
		setSelection(textNode1, 3, textNode2, 2)

		const clipboardData = dispatchClipboard('copy', host)
		expect(clipboardData.getData('application/x-markput')).toBe('lo @[world](1) f')

		// Paste at end of last span
		const lastSpan = spans[spans.length - 1]
		const lastText = firstTextNode(lastSpan)!
		host.focus()
		await flush()
		window.getSelection()!.collapse(lastText, lastText.length)

		pasteAt(host, clipboardData, lastText, lastText.length)

		await expect.element(page.getByRole('mark').nth(1)).toBeInTheDocument()
		expect(host.querySelectorAll('mark').length).toBe(2)
		expect(host.textContent).toBe('hello world foolo world f')
	})

	it('full multi-token selection should set markput MIME', async () => {
		const {host} = await mount(Inline)
		const spans = textSurfaces(host)

		// Select from start of first span to end of last span
		const textNode1 = firstTextNode(spans[0])!
		const textNode2 = firstTextNode(spans[1])!
		setSelection(textNode1, 0, textNode2, textNode2.length)

		const clipboardData = dispatchClipboard('copy', host)

		expect(clipboardData.getData('application/x-markput')).toBe('hello @[world](1) foo')
		expect(shapeOf(parseHtml(clipboardData.getData('text/html')))).toEqual([
			['SPAN', 'hello '],
			['MARK', 'world'],
			['SPAN', ' foo'],
		])
	})

	it('selecting text + mark via drag should set markput MIME', async () => {
		const {host} = await mount(Inline)

		// Simulate a browser drag selection that spans from "hello " through the mark "world".
		// In the real browser, the range starts at the first span's text node and ends at the
		// mark's text node (or the element boundary).
		// DOM: host > span[0]("hello "), mark[1]("world"), span[2](" foo")
		// Empty ones are dropped: Vue brackets a fragment with two empty text anchors, React does
		// not, and the selection can only start and end at a node that carries text.
		const textNodes = allTextNodes(host).filter(node => node.length > 0)
		expect(textNodes.length).toBe(3)

		// Select from "hello " start to "world" end (span + mark)
		setSelection(textNodes[0], 0, textNodes[1], textNodes[1].length)

		const clipboardData = dispatchClipboard('copy', host)

		expect(clipboardData.getData('application/x-markput')).toBe('hello @[world](1)')
		expect(clipboardData.getData('text/plain')).toBe('hello world')
		// The mark ends the selection, so nothing trails it in the clone either.
		expect(shapeOf(parseHtml(clipboardData.getData('text/html')))).toEqual([
			['SPAN', 'hello '],
			['MARK', 'world'],
		])
	})

	it('copy-paste round-trip: select all, copy, paste into plain text should reconstruct marks', async () => {
		// Step 1: Render source editor with a mark
		const {host: sourceHost} = await mount(Inline)

		// Select all: from start of first span to end of last span
		const spans = textSurfaces(sourceHost)
		const textNode1 = firstTextNode(spans[0])!
		const textNode2 = firstTextNode(spans[1])!
		setSelection(textNode1, 0, textNode2, textNode2.length)

		// Copy from source, and verify markput was captured
		const copied = dispatchClipboard('copy', sourceHost)
		const markput = copied.getData('application/x-markput')
		expect(markput).toBe('hello @[world](1) foo')

		// Step 2: Render target editor (plain text, no marks)
		const {host: targetHost} = await mount(PlainText)
		expect(targetHost.querySelector('mark')).toBeNull()

		const targetSpan = textSurfaces(targetHost)[0]
		targetHost.focus()
		await flush()
		expect(document.activeElement).toBe(targetHost)

		const targetTextNode = firstTextNode(targetSpan)!
		window.getSelection()!.collapse(targetTextNode, 0)

		// Paste into target
		const pasteClipboard = new DataTransfer()
		pasteClipboard.setData('text/plain', copied.getData('text/plain'))
		pasteClipboard.setData('application/x-markput', markput)
		pasteAt(targetHost, pasteClipboard, targetTextNode, 0)

		const markAfter = await page.elementLocator(targetHost).getByRole('mark').findElement()
		expect(markAfter.textContent).toBe('world')
	})
})

describe('Clipboard: paste', () => {
	beforeEach(() => {
		// Ensure no stale markup state leaks between tests. With per-container WeakMap scoping
		// this mainly guards against tests that exit early before consuming captured markup.
		window.getSelection()?.removeAllRanges()
	})

	it('pasting markput data should reconstruct the mark in plain text', async () => {
		// Start with plain text — no marks at all
		const {host} = await mount(PlainText)
		expect(host.querySelector('mark')).toBeNull()

		const span = textSurfaces(host)[0]
		host.focus()
		await flush()
		expect(document.activeElement).toBe(host)

		// Place caret at start of the span's text node
		const textNode = firstTextNode(span)!
		window.getSelection()!.collapse(textNode, 0)

		const pasteClipboard = new DataTransfer()
		pasteClipboard.setData('text/plain', 'hello world foo')
		pasteClipboard.setData('application/x-markput', 'hello @[world](1) foo')
		pasteAt(host, pasteClipboard, textNode, 0)

		const markAfter = await page.elementLocator(host).getByRole('mark').findElement()
		expect(markAfter.textContent).toBe('world')
	})

	it('pasting markput data into uncontrolled editor should reconstruct the mark', async () => {
		// The Inline story is uncontrolled (defaultValue, no onChange) and already has a mark
		const {host} = await mount(Inline)
		expect(host.querySelectorAll('mark').length).toBe(1)

		// Focus the last span " foo" and place caret at end
		const spans = textSurfaces(host)
		const lastSpan = spans[spans.length - 1]
		host.focus()
		await flush()
		expect(document.activeElement).toBe(host)

		const textNode = firstTextNode(lastSpan)!
		window.getSelection()!.collapse(textNode, textNode.length)

		// Paste additional markput data at the end
		const pasteClipboard = new DataTransfer()
		pasteClipboard.setData('text/plain', ' test')
		pasteClipboard.setData('application/x-markput', '@[test](2)')
		pasteAt(host, pasteClipboard, textNode, textNode.length)

		await expect.element(page.elementLocator(host).getByRole('mark').first()).toBeInTheDocument()
		const marksLocator = page.elementLocator(host).getByRole('mark')
		expect(marksLocator.length).toBe(2)
		expect(marksLocator.nth(0).element().textContent).toBe('world')
		expect(marksLocator.nth(1).element().textContent).toBe('test')
	})

	it('pasting markup over a selection within a span should replace the selection', async () => {
		const {host} = await mount(PlainText)

		const span = textSurfaces(host)[0]
		host.focus()
		await flush()

		const textNode = firstTextNode(span)!
		// PlainText story starts with value "abc". Select "b" (offset 1..2).
		setSelection(textNode, 1, textNode, 2)

		const pasteClipboard = new DataTransfer()
		pasteClipboard.setData('text/plain', 'world')
		pasteClipboard.setData('application/x-markput', '@[world](1)')
		pasteAt(host, pasteClipboard, textNode, 1, textNode, 2)

		const mark = await page.elementLocator(host).getByRole('mark').findElement()
		expect(mark.textContent).toBe('world')
		expect(host.textContent).toBe('aworldc')
	})

	it('keeps controlled text unchanged after paste until value is echoed', async () => {
		const onChange = vi.fn()
		const {host} = await mount(Inline, {value: CONTROLLED_VALUE, onChange})
		const spans = textSurfaces(host)
		const lastSpan = spans[spans.length - 1]
		const lastText = firstTextNode(lastSpan)!

		host.focus()
		await flush()
		window.getSelection()!.collapse(lastText, lastText.length)

		const pasteClipboard = new DataTransfer()
		pasteClipboard.setData('text/plain', '!')
		pasteAt(host, pasteClipboard, lastText, lastText.length)

		expect(onChange).toHaveBeenCalled()
		expect(lastSpan.textContent).toBe(' foo')
		expect(host.textContent).toBe('hello world foo')
	})

	it('caret should land immediately after pasted mark', async () => {
		const {host} = await mount(Inline)
		const mark = host.querySelector('mark')!
		const spans = textSurfaces(host)
		const lastSpan = spans[spans.length - 1]
		const lastText = firstTextNode(lastSpan)! // " foo"

		// Copy the full mark
		const markText = firstTextNode(mark)!
		setSelection(markText, 0, markText, markText.length)
		const copied = dispatchClipboard('copy', host)
		expect(copied.getData('application/x-markput')).toBe('@[world](1)')

		// Place caret at " |foo" (offset 1 — after the space)
		host.focus()
		await flush()
		window.getSelection()!.collapse(lastText, 1)

		pasteAt(host, copied, lastText, 1)

		await expect.element(page.getByRole('mark').nth(1)).toBeInTheDocument()
		expect(host.querySelectorAll('mark').length).toBe(2)
		const sel = window.getSelection()!
		expect(sel.isCollapsed).toBe(true)
		expect(sel.anchorNode?.textContent).toBe('foo')
		expect(sel.anchorOffset).toBe(0)
	})

	it('pasting markput data in drag mode should reconstruct the mark in a block', async () => {
		// Drag story: layout 'block', defaultValue "hello\n@[world](1)\nfoo".
		// Each line is a separate draggable block; the container is the one editing host.
		const {host} = await mount(Drag)
		expect(host.querySelectorAll('mark').length).toBe(1)

		// Focus the first block ("hello") and place caret at end
		const blocks = Array.from(host.querySelectorAll<HTMLElement>('[data-testid="block"]'))
		expect(blocks.length).toBeGreaterThan(0)
		const firstBlock = blocks[0]
		host.focus()
		await flush()

		const firstBlockText = firstTextNode(firstBlock)
		if (!firstBlockText) throw new Error('no text node in first block')

		window.getSelection()!.collapse(firstBlockText, firstBlockText.length)

		const pasteClipboard = new DataTransfer()
		pasteClipboard.setData('text/plain', ' test')
		pasteClipboard.setData('application/x-markput', '@[test](99)')
		pasteAt(host, pasteClipboard, firstBlockText, firstBlockText.length)

		await expect.element(page.getByRole('mark').first()).toBeInTheDocument()
		const marksLocator = page.getByRole('mark')
		expect(marksLocator.length).toBe(2)
		expect(marksLocator.nth(0).element().textContent).toBe('test')
	})
})

describe('Clipboard: nested marks', () => {
	beforeEach(() => {
		window.getSelection()?.removeAllRanges()
	})

	it('partial selection within nested mark children should copy correct text', async () => {
		const {host} = await mount(NestedMarkStory)
		const mark = host.querySelector('mark')!

		// NestedMark renders: <mark><strong>wor</strong><em>ld</em></mark>
		// Two text nodes: "wor" and "ld"
		const textNodes = allTextNodes(mark)
		expect(textNodes.length).toBe(2)
		expect(textNodes[0].textContent).toBe('wor')
		expect(textNodes[1].textContent).toBe('ld')

		// Select "rl" — offset 2 in "wor" to offset 1 in "ld"
		setSelection(textNodes[0], 2, textNodes[1], 1)

		const clipboardData = dispatchClipboard('copy', host)

		// Full mark is expanded in markput MIME
		expect(clipboardData.getData('application/x-markput')).toBe('@[world](1)')
		// Plain text is the visual selection: "wor"[2:] + "ld"[:1] = "rl"
		expect(clipboardData.getData('text/plain')).toBe('rl')
		// The mark's own children are inside the range, so the entry keeps the fixture's markup
		// — the proof text/html is cloned DOM and not a re-render of the markup entry.
		expect(shapeOf(parseHtml(clipboardData.getData('text/html')))).toEqual([
			['STRONG', 'r'],
			['EM', 'l'],
		])
	})

	it('paste into nested mark should use cumulative offsets', async () => {
		const {host} = await mount(NestedMarkStory)
		const mark = host.querySelector('mark')!

		// Copy the full mark first
		const markTextNodes = allTextNodes(mark)
		const lastMarkText = markTextNodes[markTextNodes.length - 1]
		setSelection(markTextNodes[0], 0, lastMarkText, lastMarkText.length)
		const copied = dispatchClipboard('copy', host)
		expect(copied.getData('application/x-markput')).toBe('@[world](1)')

		// Focus the last span " foo" and paste at offset 1
		const spans = textSurfaces(host)
		const lastSpan = spans[spans.length - 1]
		const lastText = firstTextNode(lastSpan)!
		host.focus()
		await flush()
		window.getSelection()!.collapse(lastText, 1)

		pasteAt(host, copied, lastText, 1)

		await expect.element(page.getByRole('mark').nth(1)).toBeInTheDocument()
		expect(host.querySelectorAll('mark').length).toBe(2)
		expect(host.textContent).toBe('hello world worldfoo')
	})
})

describe('Clipboard: cut', () => {
	beforeEach(() => {
		window.getSelection()?.removeAllRanges()
	})

	it('does not cut a selection that crosses a registered control', async () => {
		const {host} = await mount(Drag)
		const before = host.textContent
		const button = host.querySelector<HTMLButtonElement>('button')!
		const textNode = firstTextNode(host)!
		const selection = window.getSelection()!
		const range = document.createRange()
		range.setStart(button, 0)
		range.setEnd(textNode, textNode.length)
		selection.removeAllRanges()
		selection.addRange(range)

		const clipboardData = dispatchClipboard('cut', host)

		expect(clipboardData.getData('application/x-markput')).toBe('')
		expect(host.textContent).toBe(before)
	})

	it('cut partial text should write to clipboard and remove selection', async () => {
		const {host} = await mount(Inline)
		const spans = textSurfaces(host)

		// Select "ll" from "hello "
		const textNode = firstTextNode(spans[0])!
		setSelection(textNode, 2, textNode, 4)

		const clipboardData = dispatchClipboard('cut', host)

		expect(clipboardData.getData('application/x-markput')).toBe('ll')
		expect(clipboardData.getData('text/plain')).toBe('ll')

		await expect.element(page.getByRole('mark')).toBeInTheDocument()
		expect(host.textContent).toBe('heo world foo')
	})

	it('keeps controlled text unchanged after cut until value is echoed', async () => {
		const onChange = vi.fn()
		const {host} = await mount(Inline, {value: CONTROLLED_VALUE, onChange})
		const spans = textSurfaces(host)
		const firstSpan = spans[0]
		const textNode = firstTextNode(firstSpan)!
		setSelection(textNode, 2, textNode, 4)

		const clipboardData = dispatchClipboard('cut', host)

		expect(clipboardData.getData('application/x-markput')).toBe('ll')
		expect(onChange).toHaveBeenCalled()
		expect(firstSpan.textContent).toBe('hello ')
		expect(host.textContent).toBe('hello world foo')
	})

	it('cut across tokens should write trimmed markup and remove selection', async () => {
		const {host} = await mount(Inline)
		const spans = textSurfaces(host)

		// Select "lo world fo" — partial first span + full mark + partial last span
		const textNode1 = firstTextNode(spans[0])!
		const textNode2 = firstTextNode(spans[1])!
		setSelection(textNode1, 3, textNode2, 3)

		const clipboardData = dispatchClipboard('cut', host)

		expect(clipboardData.getData('application/x-markput')).toBe('lo @[world](1) fo')

		await expect.element(page.getByText('helo')).toBeInTheDocument()
	})

	it('cut full mark should remove the mark', async () => {
		const {host} = await mount(Inline)
		const mark = host.querySelector('mark')!

		// Select the entire mark
		const textNode = firstTextNode(mark)!
		setSelection(textNode, 0, textNode, textNode.length)

		const clipboardData = dispatchClipboard('cut', host)

		expect(clipboardData.getData('application/x-markput')).toBe('@[world](1)')

		await expect.element(page.getByRole('mark')).not.toBeInTheDocument()
		expect(host.textContent).toBe('hello  foo')
	})

	it('cut all content should clear the editor', async () => {
		const {host} = await mount(Inline)
		const spans = textSurfaces(host)

		// Select from start of first span to end of last span
		const textNode1 = firstTextNode(spans[0])!
		const textNode2 = firstTextNode(spans[1])!
		setSelection(textNode1, 0, textNode2, textNode2.length)

		const clipboardData = dispatchClipboard('cut', host)

		expect(clipboardData.getData('application/x-markput')).toBe('hello @[world](1) foo')

		await expect.element(page.getByRole('mark')).not.toBeInTheDocument()
	})
})