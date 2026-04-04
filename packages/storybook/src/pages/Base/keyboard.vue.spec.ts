// oxlint-disable typescript-eslint/no-unsafe-argument
import {composeStories} from '@storybook/vue3-vite'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-vue'
import {page, userEvent} from 'vitest/browser'

import {getElement} from '../../shared/lib/dom'
import {focusAtEnd, focusAtStart} from '../../shared/lib/focus'
import {withProps} from '../../shared/lib/testUtils.vue'
import * as BaseStories from './Base.vue.stories'

const {Default} = composeStories(BaseStories)

describe('Api: keyboard', () => {
	it('should support the "Backspace" button', async () => {
		await render(withProps(Default, {defaultValue: 'Hello @[world](1)!'}))

		const tailSpan = getElement(page.getByText('!'))
		await focusAtEnd(tailSpan)

		await userEvent.keyboard('{Backspace}')
		await expect.element(tailSpan).toHaveTextContent('')

		const mark = page.getByText(/world/)
		await expect.element(mark).toBeInTheDocument()
		await userEvent.keyboard('{Backspace}')
		await expect.element(mark).not.toBeInTheDocument()
		await expect.element(tailSpan).not.toBeInTheDocument()

		const headSpan = getElement(page.getByText(/Hello/))
		await focusAtEnd(headSpan)
		await expect.element(headSpan).toHaveTextContent('Hello')
		await expect.element(headSpan).toHaveFocus()
		await userEvent.keyboard('{Backspace>7/}')
		expect(headSpan.textContent).toBe('')
	})

	it('should support the "Delete" button', async () => {
		await render(withProps(Default, {defaultValue: 'Hello @[world](1)!'}))

		const firstSpan = getElement(page.getByText(/Hello/))
		await focusAtStart(firstSpan)

		await userEvent.keyboard('{Delete>6/}')
		await expect.element(firstSpan).toHaveTextContent('')

		const mark = page.getByText(/world/)
		await expect.element(mark).toBeInTheDocument()
		await userEvent.keyboard('{Delete}')
		await expect.element(mark).not.toBeInTheDocument()
		await expect.element(firstSpan).not.toBeInTheDocument()

		const secondSpan = getElement(page.getByText('!'))
		await expect.element(secondSpan).toHaveFocus()
		await expect.element(secondSpan).toHaveTextContent('!')
		await userEvent.keyboard('{Delete>2/}')
		await expect.element(secondSpan).toHaveTextContent('')
	})

	it('should support focus navigation between spans', async () => {
		await render(withProps(Default, {defaultValue: 'Hello @[world](1)!'}))

		const firstSpan = getElement(page.getByText(/Hello/))
		await focusAtStart(firstSpan)

		const secondSpan = getElement(page.getByText('!'))
		const firstSpanLength = firstSpan.textContent.length
		await userEvent.keyboard(`{ArrowRight>${firstSpanLength + 1}/}`)
		await expect.element(secondSpan).toHaveFocus()

		await userEvent.keyboard(`{ArrowLeft>1/}`)
		await expect.element(firstSpan).toHaveFocus()
	})

	it.skip('should select all text with keyboard shortcut "Ctrl+A"', async () => {
		const {container} = await render(withProps(Default, {defaultValue: 'Hello @[world](1)!'}))

		expect(window.getSelection()?.toString()).toBe('')

		await userEvent.click(container)
		await userEvent.keyboard('{ControlOrMeta>}a{/ControlOrMeta}')

		expect(window.getSelection()?.toString()).toBe(container.textContent)
	})

	it.todo('should replace all content when Ctrl+A then type')
	it.todo('should replace all content when Ctrl+A then paste')
	it.todo('should clear all content when Ctrl+A then delete')
})