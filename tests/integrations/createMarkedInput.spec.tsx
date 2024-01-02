import '@testing-library/jest-dom'
import {act, render} from '@testing-library/react'
import user from '@testing-library/user-event'
import {createMarkedInput, MarkedInputHandler} from 'rc-marked-input'
import React, {forwardRef} from 'react'
import {Configured} from 'storybook/stories/Base.stories'
import {describe, expect, it, vi} from 'vitest'


describe(`Utility: createMarkedInput`, () => {
	it('should render', () => {
		render(<Configured/>)
	})

	it('should support to pass a forward overlay', async () => {
		//override event listener because 'selectionchange' don't work in here
		let events: Record<string, EventListenerOrEventListenerObject> = {}
		document.addEventListener = vi.fn((event, callback) => events[event] = callback)
		document.removeEventListener = vi.fn((event, callback) => delete events[event])

		const Overlay = forwardRef(() => <span>I'm here!</span>)
		const Input = createMarkedInput({Mark: () => null, Overlay})

		const {queryByText, getByText} = render(<Input trigger="selectionChange" defaultValue="Hello @"/>)
		const span = getByText(/hello/i)
		await user.type(span, '{ArrowRight}')
		expect(span).toHaveFocus()

		await act(() => {
			// @ts-ignore
			events['selectionchange']({})
		})

		expect(queryByText('I\'m here!')).toBeInTheDocument()
	})

	it('should to support the ref prop', async () => {
		const Input = createMarkedInput({})
		let ref: MarkedInputHandler | null = null

		render(<Input ref={(el) => ref = el} value={''} onChange={() => ({})}/>)

		await act(() => {
			expect(ref?.container).not.toBeNull()
		})
	})
})