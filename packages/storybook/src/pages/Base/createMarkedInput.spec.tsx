import {render} from 'vitest-browser-react'
import {page, userEvent} from 'vitest/browser'
import type {MarkedInputHandler} from 'rc-marked-input'
import {createMarkedInput} from 'rc-marked-input'
import {forwardRef} from 'react'
import {describe, expect, it} from 'vitest'
import {composeStories} from '@storybook/react-vite'
import * as BaseStories from './Base.stories'

const {Configured} = composeStories(BaseStories)

describe(`Utility: createMarkedInput`, () => {
	it('should render', async () => {
		const {container} = await render(<Configured />)
		await expect.element(container).toBeInTheDocument()
	})

	it.todo('should support to pass a forward overlay', async () => {
		const Overlay = forwardRef(() => <span>I'm here!</span>)
		const Input = createMarkedInput({Mark: () => null, Overlay})

		await render(<Input showOverlayOn="selectionChange" defaultValue="Hello @" />)
		const span = page.getByText(/hello/i)
		await userEvent.click(span)
		await userEvent.keyboard('{ArrowRight}')
		await expect.element(span).toHaveFocus()

		await expect.element(page.getByText("I'm here!")).toBeInTheDocument()
	})

	it('should to support the ref prop', async () => {
		const Input = createMarkedInput({})
		let ref: MarkedInputHandler | null = null

		await render(<Input ref={el => (ref = el)} value={''} onChange={() => ({})} />)

		//@ts-expect-error - TODO ref is not typed correctly
		expect(ref?.container).not.toBeNull()
	})
})
