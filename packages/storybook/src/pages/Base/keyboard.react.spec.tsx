import {composeStories} from '@storybook/react-vite'
import {describe, expect, it, vi} from 'vitest'
import {render} from 'vitest-browser-react'
import {page, userEvent} from 'vitest/browser'

import {getElement} from '../../shared/lib/dom'
import {focusAtEnd, focusAtStart} from '../../shared/lib/focus'
import * as BaseStories from './Base.react.stories'

const KEYBOARD_DEFAULT_VALUE = 'Hello @[mark](1)!'

const {Default} = composeStories(BaseStories)

function getMarkFocusTarget(element: Element): HTMLElement {
	const target = element.closest<HTMLElement>('[tabindex]')
	if (!target) throw new Error('Expected mark token focus target')
	return target
}

function getFirstEditable(container: Element): HTMLElement {
	const editable = container.querySelector<HTMLElement>('[contenteditable="true"]')
	if (!editable) throw new Error('Expected an editable text surface')
	return editable
}

/**
 * Chromium's own select-all is NOT editing-host clamped: over an editor whose token
 * surfaces are separate `contenteditable` hosts it still anchors in the first text node
 * and focuses in the last, so `isAllSelected()` is true and the all-selected keyboard
 * branch is reachable from a browser test. Measured on both adapters.
 */
async function selectAll(container: Element) {
	await userEvent.click(container)
	await userEvent.keyboard('{ControlOrMeta>}a{/ControlOrMeta}')
}

/** A real `paste`: the markup clipboard entry is only readable on `ClipboardEvent.clipboardData`. */
function dispatchPasteEvent(target: HTMLElement, text: string) {
	const clipboardData = new DataTransfer()
	clipboardData.setData('text/plain', text)
	target.dispatchEvent(new ClipboardEvent('paste', {bubbles: true, cancelable: true, clipboardData}))
}

/**
 * An untrusted `beforeinput` runs no default editing action, so the browser cannot mask
 * what the handler did: `defaultPrevented` is the whole answer.
 */
function dispatchBeforeInput(target: HTMLElement, inputType: string): InputEvent {
	const event = new InputEvent('beforeinput', {bubbles: true, cancelable: true, inputType})
	target.dispatchEvent(event)
	return event
}

describe('API: keyboard', () => {
	it('support the "Backspace" button', async () => {
		await render(<Default defaultValue={KEYBOARD_DEFAULT_VALUE} />)

		const tailSpan = getElement(page.getByText('!'))
		await focusAtEnd(tailSpan)

		//Remove last span
		await userEvent.keyboard('{Backspace}')
		await expect.element(page.getByText('!')).not.toBeInTheDocument()

		//Remove mark
		const mark = page.getByText(/mark/)
		await expect.element(mark).toBeInTheDocument()
		await userEvent.keyboard('{Backspace}')
		await expect.element(mark).not.toBeInTheDocument()
		await expect.element(tailSpan).not.toBeInTheDocument()

		// Remove first span
		const headSpan = getElement(page.getByText(/Hello/))
		await focusAtEnd(headSpan)
		await expect.element(headSpan).toHaveTextContent('Hello')
		await expect.element(headSpan).toHaveFocus()
		await userEvent.keyboard('{Backspace>7/}')
		await expect.element(page.getByText(/Hello/)).not.toBeInTheDocument()
	})

	it('support the "Delete" button', async () => {
		await render(<Default defaultValue={KEYBOARD_DEFAULT_VALUE} />)

		const firstSpan = getElement(page.getByText(/Hello/))
		await focusAtStart(firstSpan)

		await userEvent.keyboard('{Delete>6/}')
		await expect.element(page.getByText(/Hello/)).not.toBeInTheDocument()

		const mark = page.getByText(/mark/)
		await expect.element(mark).toBeInTheDocument()
		await userEvent.keyboard('{Delete}')
		await expect.element(mark).not.toBeInTheDocument()
		await expect.element(firstSpan).not.toBeInTheDocument()

		const secondSpan = getElement(page.getByText('!'))
		await expect.element(secondSpan).toHaveTextContent('!')
		await focusAtStart(secondSpan)
		await userEvent.keyboard('{Delete>2/}')
		await expect.element(page.getByText('!')).not.toBeInTheDocument()
	})

	it('support focus navigation between spans', async () => {
		await render(<Default defaultValue={KEYBOARD_DEFAULT_VALUE} />)

		const firstSpan = getElement(page.getByText(/Hello/))
		await focusAtStart(firstSpan)

		const secondSpan = getElement(page.getByText('!'))
		const markFocusTarget = getMarkFocusTarget(getElement(page.getByText(/mark/)))
		const firstSpanLength = firstSpan.textContent.length
		await userEvent.keyboard(`{ArrowRight>${firstSpanLength + 1}/}`)
		await expect.element(markFocusTarget).toHaveFocus()

		await userEvent.keyboard('{ArrowRight}')
		await expect.element(secondSpan).toHaveFocus()

		await userEvent.keyboard('{ArrowLeft}')
		await expect.element(markFocusTarget).toHaveFocus()

		await userEvent.keyboard('{ArrowLeft}')
		await expect.element(firstSpan).toHaveFocus()
	})

	it('select all text with keyboard shortcut "Ctrl+A"', async () => {
		const {container} = await render(<Default defaultValue={KEYBOARD_DEFAULT_VALUE} />)

		expect(window.getSelection()?.toString()).toBe('')

		await userEvent.click(container)
		await userEvent.keyboard('{ControlOrMeta>}a{/ControlOrMeta}')

		// `Selection.prototype.toString()` stops at the first editing host, so it answers
		// 'Hello ' for a selection that really does span the editor; the range's own
		// serialization is the honest read. That truncation — not a clamped selection — is
		// what made this look broken in browser mode.
		const selection = window.getSelection()!
		expect(selection.getRangeAt(0).toString()).toBe(container.textContent)
	})

	it('replace all content when Ctrl+A then type', async () => {
		const onChange = vi.fn()
		const {container} = await render(<Default defaultValue={KEYBOARD_DEFAULT_VALUE} onChange={onChange} />)

		await selectAll(container)
		await userEvent.keyboard('X')

		expect(onChange).toHaveBeenCalledWith('X')
		expect(container.textContent).toBe('X')
	})

	it('replace all content when Ctrl+A then paste', async () => {
		const onChange = vi.fn()
		const {container} = await render(<Default defaultValue={KEYBOARD_DEFAULT_VALUE} onChange={onChange} />)

		await selectAll(container)
		dispatchPasteEvent(getFirstEditable(container), 'pasted @[other](2)')

		expect(onChange).toHaveBeenCalledWith('pasted @[other](2)')
		await expect.element(page.getByText('other')).toBeInTheDocument()
		expect(container.textContent).toBe('pasted other')
	})

	it('clear all content when Ctrl+A then delete', async () => {
		const onChange = vi.fn()
		const {container} = await render(<Default defaultValue={KEYBOARD_DEFAULT_VALUE} onChange={onChange} />)

		await selectAll(container)
		await userEvent.keyboard('{Delete}')

		expect(onChange).toHaveBeenCalledWith('')
		expect(container.textContent).toBe('')
	})

	it('keep all content when Ctrl+A then Enter', async () => {
		// The S1.6a bug, in the browser: the all-selected branch preventDefaulted EVERY
		// input type and replaced the whole value with `event.data ?? ''`, so Enter wiped
		// the input. insertParagraph must now fall through untouched, exactly as it does
		// when only part of the value is selected.
		const onChange = vi.fn()
		const {container} = await render(<Default defaultValue={KEYBOARD_DEFAULT_VALUE} onChange={onChange} />)

		await selectAll(container)
		const event = dispatchBeforeInput(getFirstEditable(container), 'insertParagraph')

		expect(event.defaultPrevented).toBe(false)
		expect(onChange).not.toHaveBeenCalled()
		expect(container.textContent).toBe('Hello mark!')
	})
})