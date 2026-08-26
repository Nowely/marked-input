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

const settle = () => new Promise(resolve => setTimeout(resolve, 0))

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
})