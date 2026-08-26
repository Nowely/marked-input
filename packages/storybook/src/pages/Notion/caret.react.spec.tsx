import {composeStories} from '@storybook/react-vite'
import {useState} from 'react'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-react'
import {page, userEvent} from 'vitest/browser'

import {ROW_CONTROLS, findEditingHost} from '../../shared/lib/dom'
import {focusAtEnd} from '../../shared/lib/focus'
import * as NotionStories from './Notion.stories.react'

/**
 * WHERE THE CARET IS ALLOWED TO BE, driven on the showcase.
 *
 * Five gestures a person makes in twenty minutes, every one of which used to leave the caret
 * somewhere they could neither see nor escape. They share one reading: a caret may sit only where
 * the document is PAINTED and EDITABLE, and a document must always end in a row it can enter.
 * Nothing below reads an internal — each is a click or a keystroke and the value that came out.
 */

const {Showcase, Empty} = composeStories(NotionStories)

type Story = typeof Showcase

/** The page as a CONTROLLED field, echoing `onChange` back — the mode every value assertion runs in. */
async function mountControlled(Story: Story, initial?: string) {
	const latest = {current: initial ?? ''}
	function Echo() {
		const [value, setValue] = useState(initial)
		latest.current = value ?? ''
		return <Story onChange={setValue} value={value} />
	}
	const {container} = await render(<Echo />)
	return {host: findEditingHost(container), value: () => latest.current}
}

const ROW = `[class*="Row"]:not(${ROW_CONTROLS}):not(${ROW_CONTROLS} *)`

const rowsOfHost = (host: HTMLElement) => [...host.querySelectorAll<HTMLElement>(ROW)]

const rowStarting = (host: HTMLElement, text: string): HTMLElement => {
	const found = rowsOfHost(host).find(row => row.textContent.trim().startsWith(text))
	if (!found) throw new Error(`no row starting ${JSON.stringify(text)}`)
	return found
}

const toggleStarting = (host: HTMLElement, text: string): HTMLElement => {
	const found = [...host.querySelectorAll<HTMLElement>('[class*="toggleRow"]')].find(row =>
		row.textContent.trim().startsWith(text)
	)
	if (!found) throw new Error(`no toggle starting ${JSON.stringify(text)}`)
	return found
}

/** The element the caret sits in — a `Text` boundary answers its parent. */
function caretElement(): HTMLElement | null {
	const selection = window.getSelection()
	if (!selection || selection.rangeCount === 0) return null
	const node = selection.getRangeAt(0).startContainer
	const element = node instanceof HTMLElement ? node : node.parentElement
	return element
}

/**
 * IS THE CARET SOMEWHERE A PERSON CAN SEE AND USE — the two readings that separate a caret from
 * a stranded one: the browser paints a box for the element it is in, and that element is not
 * inside DOM the consumer froze with `contenteditable="false"`.
 */
function caretIsUsable(): boolean {
	const element = caretElement()
	if (!element) return false
	return element.checkVisibility() && element.closest('[contenteditable="false"]') === null
}

/** Puts the caret at a text offset inside `node`, and lets the editor hear about it. */
async function caretAt(host: HTMLElement, node: Node, offset: number) {
	await userEvent.click(host)
	const selection = window.getSelection()
	if (!selection) throw new Error('no selection')
	selection.removeAllRanges()
	const range = document.createRange()
	range.setStart(node, offset)
	range.collapse(true)
	selection.addRange(range)
	await settle()
}

/** The row's OWN line, skipping the child rows a kind paints inside its own element. */
function lineTextOf(row: HTMLElement): Text {
	const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT)
	let node = walker.nextNode()
	while (node && (node.textContent === '' || node.parentElement?.closest(ROW) !== row)) node = walker.nextNode()
	if (!node) throw new Error('no line text')
	// oxlint-disable-next-line no-unsafe-type-assertion -- SHOW_TEXT guarantees Text
	return node as Text
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0))

/** Dispatches a copy carrying a mock DataTransfer, and hands it back. */
function copyFrom(host: HTMLElement): DataTransfer {
	const clipboardData = new DataTransfer()
	const event = new ClipboardEvent('copy', {clipboardData, bubbles: true})
	Object.defineProperty(event, 'target', {value: host, writable: false})
	host.dispatchEvent(event)
	return clipboardData
}

/** The paste sequence a browser produces: `paste` carries the data, `beforeinput` the target range. */
function pasteAtCaret(host: HTMLElement, clipboardData: DataTransfer): void {
	const live = window.getSelection()?.getRangeAt(0)
	if (!live) throw new Error('no caret to paste at')
	host.dispatchEvent(new ClipboardEvent('paste', {clipboardData, bubbles: true}))
	const targetRange = document.createRange()
	targetRange.setStart(live.startContainer, live.startOffset)
	targetRange.setEnd(live.endContainer, live.endOffset)
	const event = new InputEvent('beforeinput', {inputType: 'insertFromPaste', bubbles: true, cancelable: true})
	Object.defineProperty(event, 'getTargetRanges', {value: () => [targetRange]})
	Object.defineProperty(event, 'dataTransfer', {value: clipboardData})
	host.dispatchEvent(event)
}

describe('the caret goes where a person can follow it', () => {
	/**
	 * AN ATOMIC ROW HOLDS NO CARET POSITION. Its interior is `contenteditable="false"` — that is
	 * what `useControlRef()` writes — so a click parks the browser's own caret inside it, ArrowDown
	 * cannot move it and every keystroke after it is dropped with nothing said. The editor puts the
	 * caret at the nearest position it may occupy instead, which is the row after the block.
	 */
	it('moves the caret out of an atomic block that was clicked', async () => {
		const {value} = await mountControlled(Showcase)

		await page.getByText('Launch tasks', {exact: true}).first().click()
		await settle()
		await userEvent.keyboard('ZZZ')

		expect(caretIsUsable()).toBe(true)
		expect(value()).toContain('## ZZZLaunch tasks')
	})

	/**
	 * A DOCUMENT MUST END IN A ROW THE CARET CAN ENTER. `/` turns THIS row into the chosen kind, so
	 * a board picked on the only row of an empty page leaves a document made of one row no caret
	 * can enter — and the grip menu's "Add below" was the only way back out.
	 */
	it('opens a row after an atomic block that ends the document', async () => {
		const {host, value} = await mountControlled(Empty, '')

		await focusAtEnd(rowsOfHost(host)[0])
		await userEvent.keyboard('/')
		await page.getByText('Board', {exact: true}).click()
		await settle()

		expect(value()).toBe('@board\nTo do\n- First card\n@end\n')
		await userEvent.keyboard('below')
		expect(value()).toBe('@board\nTo do\n- First card\n@end\nbelow')
	})

	/**
	 * THE SAME RULE FOR A ROW THE CARET CANNOT LEAVE. A fence's body is raw, so Enter inside it is a
	 * newline for ever; at the document's end that made the block a dead end with no row after it
	 * and no gesture that opened one.
	 */
	it('opens a row after a raw-bodied block that ends the document', async () => {
		const {host, value} = await mountControlled(Empty, 'alpha\n')

		await userEvent.click(rowsOfHost(host).at(-1)!)
		await settle()
		await userEvent.keyboard('/')
		await page.getByText('Code', {exact: true}).click()
		await settle()

		expect(value()).toBe('alpha\n```bash\n\n```\n')
	})

	/**
	 * A CARET MAY NOT ENTER A SUBTREE WITH NO BOXES. A closed toggle paints its children rather than
	 * unmounting them — an unpainted row leaves the DOM layer and takes its anchors with it — so a
	 * row indented under one is in the document and on no screen: eleven characters typed there
	 * landed in the value with no visible caret.
	 */
	it('refuses to indent a row into a closed toggle', async () => {
		const {host, value} = await mountControlled(Showcase)

		const toggle = toggleStarting(host, 'Single-region GA first')
		const title = lineTextOf(toggle)
		await caretAt(host, title, title.length)
		await userEvent.keyboard('{Enter}')
		await settle()
		await userEvent.keyboard('{Tab}')
		await settle()
		await userEvent.keyboard('eleven char')

		expect(caretIsUsable()).toBe(true)
		expect(value()).toContain('\n▸ eleven char\n')
		expect(value()).not.toContain('\t▸ eleven char')
	})

	/**
	 * A CLIP OF WHOLE ROWS IS PASTED AS ROWS. This editor's own clipboard entry is the value's own
	 * projection — a lead and an opener per line — and splicing it into a row's body wrote those
	 * bytes as PROSE: a literal `'- '` in the middle of a paragraph, and a literal tab in front of
	 * it. Pasting the same clip on an empty row was clean, which is the two readings this closes.
	 */
	it('opens a two-row clip as rows when it is pasted at a caret', async () => {
		const {host, value} = await mountControlled(Showcase)

		await focusAtEnd(rowStarting(host, 'Awaiting quota approval'))
		await userEvent.keyboard('{Escape}')
		await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}')
		const clip = copyFrom(host)
		expect(clip.getData('application/x-markput')).toBe('\t- Awaiting quota approval\n- Support headcount at 60%')

		await focusAtEnd(rowStarting(host, 'Apollo moves the collaboration'))
		pasteAtCaret(host, clip)
		await settle()

		expect(value()).toContain(
			'downstream assumes.\n\t- Awaiting quota approval\n- Support headcount at 60%\n@toc\n'
		)
	})

	/**
	 * A DEPTH IN THE VALUE IS A DEPTH ON THE SCREEN. A row nested under a PARAGRAPH — which Tab and
	 * a drop both write, and the drop indicator promises — painted at its parent's own left edge,
	 * so the indent the document holds was invisible. A nested bullet is the measure: one indent
	 * step, whoever the parent is.
	 */
	it('paints a row nested under a paragraph at the nesting step', async () => {
		const {host} = await mountControlled(
			Empty,
			'alpha\n\tnested line\n\t> nested quote\n> quote\n- bullet\n\t- nested bullet'
		)

		// The step a NESTING adds, measured per kind against the same kind at depth 0 — a quote and
		// a bullet draw their own left edges differently, so their absolute boxes never agree.
		const left = (text: string) => Math.round(rowStarting(host, text).getBoundingClientRect().left)
		const step = left('nested bullet') - left('bullet')

		expect(step).toBeGreaterThan(0)
		expect(left('nested quote') - left('quote')).toBe(step)
		// AND A SOFT BREAK IS NOT A NESTING. A continuation line is a kindless child row — the same
		// bytes Tab writes — and takes no step at all; what separates it from its parent's box is
		// that parent's own padding, which every child inside the box starts at.
		expect(left('nested line') - left('alpha')).toBeLessThan(step)
	})
})