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
	//TODO not working
	it.todo('should typed with default values of options', async () => {
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

	// TODO: user.pointer with offset is not available in vitest/browser.
	// Need to rewrite using focusAtOffset helper or native Selection API.
	it.todo('should appear a overlay component by trigger', async () => {
		await render(
			<Default
				showOverlayOn="selectionChange"
				defaultValue="@ @[mark](1)!"
				options={[
					{
						markup: '@[__label__](__value__)',
						slotProps: {
							overlay: {
								trigger: '@',
								data: ['Item'],
							},
						},
					},
				]}
			/>
		)
		// const span = page.getByText(/@/i)

		// await user.pointer({target: span, offset: 0, keys: '[MouseLeft]'})
		// await user.pointer({target: span, offset: 1, keys: '[MouseLeft]'})

		await expect.element(page.getByText('Item')).toBeInTheDocument()
	})
})
