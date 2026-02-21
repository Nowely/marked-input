import {render} from 'vitest-browser-react'
import {page, userEvent} from 'vitest/browser'
import {describe, expect, it} from 'vitest'
import {composeStories} from '@storybook/react-vite'
import * as BaseStories from '../Base/Base.stories'
import * as OverlayStories from './Overlay.stories'
import {focusAtEnd} from '../../shared/lib/focus'

const {Default} = composeStories(BaseStories)
const {DefaultOverlay} = composeStories(OverlayStories)

describe('API: Overlay and Triggers', () => {
	it('should work with empty options array', async () => {
		const {container} = await render(<DefaultOverlay options={[]} />)

		const element = container.firstElementChild?.firstElementChild as HTMLElement
		await focusAtEnd(element)
		await userEvent.keyboard('abc')

		await expect.element(page.getByText(DefaultOverlay.args.defaultValue + 'abc')).toBeInTheDocument()
	})

	it('should typed with default values of options', async () => {
		const {container} = await render(<DefaultOverlay />)

		const element = container.firstElementChild?.firstElementChild as HTMLElement
		await focusAtEnd(element)
		await userEvent.keyboard('abc')

		await expect.element(page.getByText(DefaultOverlay.args.defaultValue + 'abc')).toBeInTheDocument()
	})

	it('should appear a overlay component by trigger', async () => {
		const {container} = await render(
			<Default
				defaultValue="Hello "
				options={[
					{
						markup: '@[__label__](__value__)',
						overlay: {
							trigger: '@',
							data: ['Item'],
						},
					},
				]}
			/>
		)

		// Focus and type the trigger character to show overlay
		const element = container.firstElementChild?.firstElementChild as HTMLElement
		await focusAtEnd(element)
		await userEvent.keyboard('@')

		// Overlay should appear with the data item
		await expect.element(page.getByText('Item')).toBeInTheDocument()
	})
})
