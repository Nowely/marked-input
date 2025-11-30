import '@testing-library/jest-dom'
import {act, render} from '@testing-library/react'
import {userEvent} from 'vitest/browser'
import type {MarkedInputHandler} from 'rc-marked-input'
import {createMarkedInput} from 'rc-marked-input'
import {forwardRef} from 'react'
import {describe, expect, it, vi} from 'vitest'
import {composeStories} from '@storybook/react-vite'
import * as BaseStories from './Base.stories'

const {Configured} = composeStories(BaseStories)

describe(`Utility: createMarkedInput`, () => {
	it('should render', () => {
		const {container} = render(<Configured />)
		expect(container).toBeInTheDocument()
	})

	// TODO: This test relies on mocking selectionchange event which doesn't work properly
	// with vitest/browser userEvent. Need to investigate alternative approach.
	it.todo('should support to pass a forward overlay', async () => {
		//override event listener because 'selectionchange' don't work in here
		const events: Record<string, EventListenerOrEventListenerObject> = {}
		document.addEventListener = vi.fn((event, callback) => (events[event] = callback))
		document.removeEventListener = vi.fn(event => delete events[event])

		const Overlay = forwardRef(() => <span>I'm here!</span>)
		const Input = createMarkedInput({Mark: () => null, Overlay})

		const {queryByText, getByText} = render(<Input showOverlayOn="selectionChange" defaultValue="Hello @" />)
		const span = getByText(/hello/i)
		await userEvent.click(span)
		await userEvent.keyboard('{ArrowRight}')
		expect(span).toHaveFocus()

		await act(() => {
			// @ts-ignore
			events['selectionchange']({})
		})

		expect(queryByText("I'm here!")).toBeInTheDocument()
	})

	it('should to support the ref prop', async () => {
		const Input = createMarkedInput({})
		let ref: MarkedInputHandler | null = null

		render(<Input ref={el => (ref = el)} value={''} onChange={() => ({})} />)

		await act(() => {
			expect(ref?.container).not.toBeNull()
		})
	})
})

