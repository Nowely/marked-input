import {composeStories} from '@storybook/react-vite'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-react'
import {page, userEvent} from 'vitest/browser'

import {getElement} from '../../shared/lib/dom'
import {focusAtEnd, focusAtStart} from '../../shared/lib/focus'
import * as BaseStories from './Base.react.stories'

const KEYBOARD_DEFAULT_VALUE = 'Hello @[mark](1)!'

const {Default} = composeStories(BaseStories)

function getMarkFocusTarget(element: Element): HTMLElement {
	const target = element.closest<HTMLElement>('span[tabindex]')
	if (!target) throw new Error('Expected mark token focus target')
	return target
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

	// It's not working in browser mode, but works in real
	it.skip('select all text with keyboard shortcut "Ctrl+A"', async () => {
		const {container} = await render(<Default defaultValue={KEYBOARD_DEFAULT_VALUE} />)

		expect(window.getSelection()?.toString()).toBe('')

		await userEvent.click(container)
		await userEvent.keyboard('{ControlOrMeta>}a{/ControlOrMeta}')

		expect(window.getSelection()?.toString()).toBe(container.textContent)
	})

	// Ctrl+A fix tests - issue #1 in INCONSISTENCIES.md
	// NOTE: These tests cannot be reliably automated with Vitest browser mode
	// because beforeinput events are not properly captured on contentEditable elements.
	// The fix is implemented and works in production, but automated testing is limited
	// by Vitest browser environment. Manual verification via Storybook is recommended.
	it.todo('replace all content when Ctrl+A then type')
	it.todo('replace all content when Ctrl+A then paste')
	it.todo('clear all content when Ctrl+A then delete')
})