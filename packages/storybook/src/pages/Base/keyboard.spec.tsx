import {render} from '@testing-library/react'
import {userEvent} from 'vitest/browser'
import {describe, expect, it} from 'vitest'
import {composeStories} from '@storybook/react-vite'
import * as BaseStories from './Base.stories'
import {focusAtEnd, focusAtStart} from '../../shared/lib/focus'

const {Default} = composeStories(BaseStories)

describe('Api: keyboard', () => {
	it('should support the "Backspace" button', async () => {
		const {getByText} = render(<Default defaultValue="Hello @[mark](1)!" />)

		const tailSpan = getByText('!')
		await focusAtEnd(tailSpan)

		//Remove last span
		await userEvent.keyboard('{Backspace}')
		await expect.element(tailSpan).toHaveTextContent('')

		//Remove mark
		const mark = getByText(/mark/)
		await expect.element(mark).toBeInTheDocument()
		await userEvent.keyboard('{Backspace}')
		await expect.element(mark).not.toBeInTheDocument()
		await expect.element(tailSpan).not.toBeInTheDocument()

		// Remove first span
		const headSpan = getByText(/Hello/)
		await expect.element(headSpan).toHaveTextContent('Hello')
		await expect.element(headSpan).toHaveFocus()
		await userEvent.keyboard('{Backspace>7/}')
		await expect.element(headSpan).toHaveTextContent('')
	})

	it('should support the "Delete" button', async () => {
		const {getByText} = render(<Default defaultValue="Hello @[mark](1)!" />)

		const firstSpan = getByText(/Hello/)
		await focusAtStart(firstSpan)

		await userEvent.keyboard('{Delete>6/}')
		await expect.element(firstSpan).toHaveTextContent('')

		const mark = getByText(/mark/)
		await expect.element(mark).toBeInTheDocument()
		await userEvent.keyboard('{Delete}')
		await expect.element(mark).not.toBeInTheDocument()
		await expect.element(firstSpan).not.toBeInTheDocument()

		const secondSpan = getByText('!')
		await expect.element(secondSpan).toHaveFocus()
		await expect.element(secondSpan).toHaveTextContent('!')
		await userEvent.keyboard('{Delete>2/}')
		await expect.element(secondSpan).toHaveTextContent('')
	})

	it('should support focus navigation between spans', async () => {
		const {getByText} = render(<Default defaultValue="Hello @[mark](1)!" />)

		const firstSpan = getByText(/Hello/)
		await focusAtStart(firstSpan)

		const secondSpan = getByText('!')
		const firstSpanLength = firstSpan.textContent?.length ?? 0
		await userEvent.keyboard(`{ArrowRight>${firstSpanLength + 1}/}`)
		await expect.element(secondSpan).toHaveFocus()

		await userEvent.keyboard(`{ArrowLeft>1/}`)
		await expect.element(firstSpan).toHaveFocus()
	})

	//TODO not working
	it.todo('should select all text with keyboard shortcut "Ctrl+A"', async () => {
		const {container} = render(<Default defaultValue="Hello @[mark](1)!" />)
		const [span] = container.querySelectorAll('span')

		await focusAtStart(span)

		expect(window.getSelection()?.toString()).toBe('')

		await userEvent.type(span, '{Control>}a{/Control}')
		expect(window.getSelection()?.toString()).toBe(container.textContent)

		await userEvent.type(span, '{Control>}A{/Control}')
		expect(window.getSelection()?.toString()).toBe(container.textContent)
	})
})

