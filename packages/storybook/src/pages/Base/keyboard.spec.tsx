import {render} from 'vitest-browser-react'
import {page, userEvent} from 'vitest/browser'
import {describe, expect, it} from 'vitest'
import {composeStories} from '@storybook/react-vite'
import * as BaseStories from './Base.stories'
import {focusAtEnd, focusAtStart} from '../../shared/lib/focus'

const {Default} = composeStories(BaseStories)

describe('Api: keyboard', () => {
	it.todo('should support the "Backspace" button', async () => {
		const {container} = await render(<Default defaultValue="Hello @[mark](1)!" />)

		const tailSpan = page.getByText('!').element() as HTMLElement
		await focusAtEnd(tailSpan)

		//Remove last span
		await userEvent.keyboard('{Backspace}')
		await expect.element(tailSpan).toHaveTextContent('')

		//Remove mark
		const mark = page.getByText(/mark/)
		await expect.element(mark).toBeInTheDocument()
		await userEvent.keyboard('{Backspace}')
		await expect.element(mark).not.toBeInTheDocument()
		await expect.element(tailSpan).not.toBeInTheDocument()

		// Remove first span
		const headSpan = page.getByText(/Hello/).element() as HTMLElement
		await focusAtStart(headSpan)
		await expect.element(headSpan).toHaveTextContent('Hello')
		await expect.element(headSpan).toHaveFocus()
		await userEvent.keyboard('{Backspace>7/}')
		expect(headSpan.textContent).toBe('')
	})

	it('should support the "Delete" button', async () => {
		const {container} = await render(<Default defaultValue="Hello @[mark](1)!" />)

		const firstSpan = page.getByText(/Hello/).element() as HTMLElement
		await focusAtStart(firstSpan)

		await userEvent.keyboard('{Delete>6/}')
		await expect.element(firstSpan).toHaveTextContent('')

		const mark = page.getByText(/mark/)
		await expect.element(mark).toBeInTheDocument()
		await userEvent.keyboard('{Delete}')
		await expect.element(mark).not.toBeInTheDocument()
		await expect.element(firstSpan).not.toBeInTheDocument()

		const secondSpan = page.getByText('!').element() as HTMLElement
		await expect.element(secondSpan).toHaveFocus()
		await expect.element(secondSpan).toHaveTextContent('!')
		await userEvent.keyboard('{Delete>2/}')
		await expect.element(secondSpan).toHaveTextContent('')
	})

	it('should support focus navigation between spans', async () => {
		await render(<Default defaultValue="Hello @[mark](1)!" />)

		const firstSpan = page.getByText(/Hello/).element() as HTMLElement
		await focusAtStart(firstSpan)

		const secondSpan = page.getByText('!').element() as HTMLElement
		const firstSpanLength = firstSpan.textContent?.length ?? 0
		await userEvent.keyboard(`{ArrowRight>${firstSpanLength + 1}/}`)
		await expect.element(secondSpan).toHaveFocus()

		await userEvent.keyboard(`{ArrowLeft>1/}`)
		await expect.element(firstSpan).toHaveFocus()
	})

	//TODO not working
	it.todo('should select all text with keyboard shortcut "Ctrl+A"', async () => {
		const {container} = await render(<Default defaultValue="Hello @[mark](1)!" />)
		const [span] = container.querySelectorAll('span')

		await focusAtStart(span)

		expect(window.getSelection()?.toString()).toBe('')

		await userEvent.type(span, '{Control>}a{/Control}')
		expect(window.getSelection()?.toString()).toBe(container.textContent)

		await userEvent.type(span, '{Control>}A{/Control}')
		expect(window.getSelection()?.toString()).toBe(container.textContent)
	})
})

