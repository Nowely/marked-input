import '@testing-library/jest-dom'
import {act, render} from '@testing-library/react'
import user from '@testing-library/user-event'
import {describe, expect, it, vi} from 'vitest'
import {Story} from '../../storybook/stories'

const {Default} = Story.Base
const {DefaultOverlay} = Story.Overlay

describe('API: Overlay and Triggers', () => {
	//TODO not working
	it.todo('should typed with default values of options', async () => {
		const {container, getByText} = render(<DefaultOverlay options={[]} />)

		const element = container.firstElementChild?.firstElementChild as HTMLElement
		await user.type(element, 'abc')

		expect(getByText(DefaultOverlay.args.defaultValue + 'abc')).toBeInTheDocument()
	})

	it('should typed with default values of options', async () => {
		const {container, getByText} = render(<DefaultOverlay />)

		const element = container.firstElementChild?.firstElementChild as HTMLElement
		await user.type(element, 'abc')

		expect(getByText(DefaultOverlay.args.defaultValue + 'abc')).toBeInTheDocument()
	})

	it('should appear a overlay component by trigger', async () => {
		//override event listener because 'selectionchange' don't work in here
		const events: Record<string, EventListenerOrEventListenerObject> = {}
		document.addEventListener = vi.fn((event, callback) => (events[event] = callback))
		document.removeEventListener = vi.fn(event => delete events[event])

		const {getByText, findByText} = render(
			<Default
				showOverlayOn="selectionChange"
				defaultValue="@ @[mark](1)!"
				options={[{markup: '@[__label__](__value__)', overlayTrigger: '@', data: ['Item']}]}
			/>
		)
		const span = getByText(/@/i)

		await user.pointer({target: span, offset: 0, keys: '[MouseLeft]'})
		await user.pointer({target: span, offset: 1, keys: '[MouseLeft]'})

		act(() => {
			// @ts-ignore
			events['selectionchange']({})
		})

		expect(await findByText('Item')).toBeInTheDocument()
	})
})
