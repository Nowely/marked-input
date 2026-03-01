import {render} from 'vitest-browser-react'
import {page, userEvent} from 'vitest/browser'

import {composeStories} from '@storybook/react-vite'
import * as BaseStories from '../Base/Base.stories'
import * as OverlayStories from './Overlay.stories'
import {focusAtEnd, verifyCaretPosition} from '../../shared/lib/focus'
import {describe, expect, it} from 'vitest'

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

	it('should reopen overlay after closing', async () => {
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

		const element = container.firstElementChild?.firstElementChild as HTMLElement
		await focusAtEnd(element)

		// Open overlay
		await userEvent.keyboard('@')
		await expect.element(page.getByText('Item')).toBeInTheDocument()

		// Close overlay with Escape
		await userEvent.keyboard('{Escape}')
		await expect.element(page.getByText('Item')).not.toBeInTheDocument()

		// Add space and reopen overlay
		await userEvent.keyboard(' @')
		await expect.element(page.getByText('Item')).toBeInTheDocument()
	})

	it('should convert selection to mark token, not raw annotation', async () => {
		const {container} = await render(
			<Default
				defaultValue="Hello "
				options={[
					{
						markup: '@[__value__](__meta__)',
						overlay: {
							trigger: '@',
							data: ['Item'],
						},
					},
				]}
			/>
		)

		const element = container.firstElementChild?.firstElementChild as HTMLElement
		await focusAtEnd(element)
		await userEvent.keyboard('@')
		await expect.element(page.getByText('Item')).toBeInTheDocument()

		// Select the item from overlay
		await page.getByText('Item').click()

		// The selected value should render as a <mark> element, not raw annotation text
		await expect.element(page.getByRole('mark')).toBeInTheDocument()
	})

	it('should restore focus after selection from overlay', async () => {
		// Use a value with existing marks so the new mark is inserted in the MIDDLE.
		// This distinguishes "focus after mark" (childIndex + 2) from "focus at tail".
		// After parse: [span("Start "), mark("A"), span(" mid "), mark("B"), span(" end")]
		const {container} = await render(
			<Default
				defaultValue="Start @[A](0) mid @[B](0) end"
				options={[
					{
						markup: '@[__value__](__meta__)',
						overlay: {
							trigger: '@',
							data: ['Item'],
						},
					},
				]}
			/>
		)

		const editableContainer = container.firstElementChild as HTMLElement
		// Focus the middle span (" mid ") at child index 2
		const middleSpan = editableContainer.children[2] as HTMLElement
		await focusAtEnd(middleSpan)
		await userEvent.keyboard('@')
		await expect.element(page.getByText('Item')).toBeInTheDocument()

		// Select the item from overlay
		await page.getByText('Item').click()

		// After re-parse: [span("Start "), mark("A"), span(" mid "), mark("Item"), span(""), mark("B"), span(" end")]
		// Focus should be on span("") at childIndex + 2 = 4, NOT tail at index 6.
		// Caret position: "Start " (6) + "A" (1) + " mid " (5) + "Item" (4) = 16
		verifyCaretPosition(editableContainer, 16)
	})
})
