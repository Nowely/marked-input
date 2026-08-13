import {describe, expect, it, vi} from 'vitest'
import {page, userEvent} from 'vitest/browser'

import {caretIsInside, editingHost, getElement} from '../../shared/lib/dom'
import {focusAtEnd, focusAtStart} from '../../shared/lib/focus'
import {composePage, mount} from '../../shared/lib/page'
import * as BaseStories from './Base.stories'

const KEYBOARD_DEFAULT_VALUE = 'Hello @[mark](1)!'

const {Default} = composePage(BaseStories)

/**
 * Select-all under one host is the plain native thing: the container IS the editing host,
 * so Chromium clamps the selection to exactly the editor's contents.
 */
async function selectAll(host: Element) {
	await userEvent.click(host)
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
		await mount(Default, {defaultValue: KEYBOARD_DEFAULT_VALUE})

		const tailSpan = getElement(page.getByText('!'))
		await focusAtEnd(tailSpan)

		// Remove last span
		await userEvent.keyboard('{Backspace}')
		await expect.element(page.getByText('!')).not.toBeInTheDocument()

		// Remove mark
		const mark = page.getByText(/mark/)
		await expect.element(mark).toBeInTheDocument()
		await userEvent.keyboard('{Backspace}')
		await expect.element(mark).not.toBeInTheDocument()
		await expect.element(tailSpan).not.toBeInTheDocument()

		// Remove first span
		const headSpan = getElement(page.getByText(/Hello/))
		await focusAtEnd(headSpan)
		await expect.element(headSpan).toHaveTextContent('Hello')
		await expect.element(editingHost(headSpan)).toHaveFocus()
		await userEvent.keyboard('{Backspace>7/}')
		await expect.element(page.getByText(/Hello/)).not.toBeInTheDocument()
	})

	it('support the "Delete" button', async () => {
		await mount(Default, {defaultValue: KEYBOARD_DEFAULT_VALUE})

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

	it('support caret navigation across a mark', async () => {
		await mount(Default, {defaultValue: KEYBOARD_DEFAULT_VALUE})

		const firstSpan = getElement(page.getByText(/Hello/))
		await focusAtStart(firstSpan)

		const secondSpan = getElement(page.getByText('!'))
		const host = editingHost(firstSpan)

		// The mark is an atomic, not a stop: the walk to the end of the first span is one
		// keystroke per character, and the mark costs exactly one more.
		await userEvent.keyboard(`{ArrowRight>${firstSpan.textContent.length}/}`)
		expect(caretIsInside(firstSpan)).toBe(true)

		await userEvent.keyboard('{ArrowRight}')
		expect(caretIsInside(secondSpan)).toBe(true)

		await userEvent.keyboard('{ArrowLeft}')
		expect(caretIsInside(firstSpan)).toBe(true)

		await expect.element(host).toHaveFocus()
	})

	it('leaves the field on Tab', async () => {
		// BREAKING (one-host migration): marks lost `tabindex` and are no longer tab stops.
		// Tab is the plain native "leave the editor" it is in a textarea.
		const {host} = await mount(Default, {defaultValue: KEYBOARD_DEFAULT_VALUE})

		await userEvent.click(host)
		await expect.element(host).toHaveFocus()

		await userEvent.keyboard('{Tab}')

		expect(host.contains(document.activeElement)).toBe(false)
		expect(document.activeElement).not.toBe(host)
	})

	it('select all text with keyboard shortcut "Ctrl+A"', async () => {
		const {host} = await mount(Default, {defaultValue: KEYBOARD_DEFAULT_VALUE})

		expect(window.getSelection()?.toString()).toBe('')

		await userEvent.click(host)
		await userEvent.keyboard('{ControlOrMeta>}a{/ControlOrMeta}')

		// One host, one editing boundary: the select-all range is exactly the editor's
		// contents, and `Selection.toString()` no longer truncates at the first span.
		const selection = window.getSelection()!
		expect(selection.getRangeAt(0).toString()).toBe(host.textContent)
	})

	it('replace all content when Ctrl+A then type', async () => {
		const onChange = vi.fn()
		const {host} = await mount(Default, {defaultValue: KEYBOARD_DEFAULT_VALUE, onChange})

		await selectAll(host)
		await userEvent.keyboard('X')

		expect(onChange).toHaveBeenCalledWith('X')
		expect(host.textContent).toBe('X')
	})

	it('replace all content when Ctrl+A then paste', async () => {
		const onChange = vi.fn()
		const {host} = await mount(Default, {defaultValue: KEYBOARD_DEFAULT_VALUE, onChange})

		await selectAll(host)
		dispatchPasteEvent(host, 'pasted @[other](2)')

		expect(onChange).toHaveBeenCalledWith('pasted @[other](2)')
		await expect.element(page.getByText('other')).toBeInTheDocument()
		expect(host.textContent).toBe('pasted other')
	})

	it('clear all content when Ctrl+A then delete', async () => {
		const onChange = vi.fn()
		const {host} = await mount(Default, {defaultValue: KEYBOARD_DEFAULT_VALUE, onChange})

		await selectAll(host)
		await userEvent.keyboard('{Delete}')

		expect(onChange).toHaveBeenCalledWith('')
		expect(host.textContent).toBe('')
	})

	it('replace all content with a newline when Ctrl+A then Enter', async () => {
		// Enter is an EDIT the guard owns, not a default it forwards: under one host a
		// forwarded insertParagraph would build a <div>/<br> in DOM the model owns. So the
		// all-selected branch replaces the value with '\n' — the same replacement the
		// partial-selection path inserts (core `input.spec`'s two newline pins).
		const onChange = vi.fn()
		const {host} = await mount(Default, {defaultValue: KEYBOARD_DEFAULT_VALUE, onChange})

		await selectAll(host)
		const event = dispatchBeforeInput(host, 'insertParagraph')

		expect(event.defaultPrevented).toBe(true)
		expect(onChange).toHaveBeenCalledWith('\n')
	})
})