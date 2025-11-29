import '@testing-library/jest-dom'
import {render} from '@testing-library/react'
import user from '@testing-library/user-event'
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
		await user.keyboard('{Backspace}')
		expect(tailSpan).toHaveTextContent('')

		//Remove mark
		const mark = getByText(/mark/)
		expect(mark).toBeInTheDocument()
		await user.keyboard('{Backspace}')
		expect(mark).not.toBeInTheDocument()
		expect(tailSpan).not.toBeInTheDocument()

		// Remove first span
		const headSpan = getByText(/Hello/)
		expect(headSpan).toHaveTextContent('Hello ', {normalizeWhitespace: false})
		expect(headSpan).toHaveFocus()
		await user.keyboard('{Backspace>7/}')
		expect(headSpan).toHaveTextContent('')
	})

	it('should support the "Delete" button', async () => {
		const {getByText} = render(<Default defaultValue="Hello @[mark](1)!" />)

		const firstSpan = getByText(/Hello/)
		await focusAtStart(firstSpan)

		await user.keyboard('{Delete>6/}')
		expect(firstSpan).toHaveTextContent('')

		const mark = getByText(/mark/)
		expect(mark).toBeInTheDocument()
		await user.keyboard('{Delete}')
		expect(mark).not.toBeInTheDocument()
		expect(firstSpan).not.toBeInTheDocument()

		const secondSpan = getByText('!')
		expect(secondSpan).toHaveFocus()
		expect(secondSpan).toHaveTextContent('!')
		await user.keyboard('{Delete>2/}')
		expect(secondSpan).toHaveTextContent('')
	})

	it('should support focus navigation between spans', async () => {
		const {getByText} = render(<Default defaultValue="Hello @[mark](1)!" />)

		const firstSpan = getByText(/Hello/)
		await focusAtStart(firstSpan)

		const secondSpan = getByText('!')
		const firstSpanLength = firstSpan.textContent?.length ?? 0
		await user.keyboard(`{ArrowRight>${firstSpanLength + 1}/}`)
		expect(secondSpan).toHaveFocus()

		await user.keyboard(`{ArrowLeft>1/}`)
		expect(firstSpan).toHaveFocus()
	})

	it('should select all text with keyboard shortcut "Ctrl+A"', async () => {
		const {container} = render(<Default defaultValue="Hello @[mark](1)!" />)
		const [span] = container.querySelectorAll('span')

		await focusAtStart(span)

		expect(window.getSelection()?.toString()).toBe('')

		await user.type(span, '{Control>}a{/Control}')
		expect(window.getSelection()?.toString()).toBe(container.textContent)

		await user.type(span, '{Control>}A{/Control}')
		expect(window.getSelection()?.toString()).toBe(container.textContent)
	})
})

