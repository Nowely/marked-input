import type {MarkProps} from '@markput/react'
import {MarkedInput} from '@markput/react'
import {composeStories} from '@storybook/react-vite'
import {useState} from 'react'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-react'
import {page, userEvent} from 'vitest/browser'

import {textSurfaces} from '../../shared/lib/dom'
import {focusAtEnd, verifyCaretPosition} from '../../shared/lib/focus'
import * as BaseStories from '../Base/Base.stories'
import * as OverlayStories from './Overlay.stories'

const {Default} = composeStories(BaseStories)
const {DefaultOverlay} = composeStories(OverlayStories)

/** The nth TEXT token surface — bare spans now, so they are addressed structurally. */
function editableText(container: ParentNode, index = 0): HTMLElement {
	const host = container.querySelector<HTMLElement>('[contenteditable="true"]')
	if (!host) throw new Error('Expected the editing host')
	const element = textSurfaces(host).at(index)
	if (!element) throw new Error('Expected a text token surface')
	return element
}

const SUGGESTIONS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth']

/**
 * The shape the `Configured` story has and no other overlay spec did: CONTROLLED, with a
 * parent that echoes `onChange` straight back into `value`, and `showOverlayOn` left at its
 * default (`'change'`). Every other overlay case here is uncontrolled, which is the working
 * path — the trigger probe used to read one generation stale only under this wiring.
 */
function EchoingParent() {
	const [value, setValue] = useState('calling ')
	return (
		<MarkedInput
			Mark={({value: label}: MarkProps) => <mark>{label}</mark>}
			value={value}
			onChange={setValue}
			options={[
				{
					markup: '@[__value__](__meta__)',
					overlay: {trigger: '@', data: SUGGESTIONS},
				},
			]}
		/>
	)
}

describe('API: Overlay and Triggers', () => {
	it('work with empty options array', async () => {
		const {container} = await render(<DefaultOverlay options={[]} />)

		const element = editableText(container)
		await focusAtEnd(element)
		await userEvent.keyboard('abc')

		await expect.element(page.getByText(DefaultOverlay.args.defaultValue + 'abc')).toBeInTheDocument()
	})

	it('typed with default values of options', async () => {
		const {container} = await render(<DefaultOverlay />)

		const element = editableText(container)
		await focusAtEnd(element)
		await userEvent.keyboard('abc')

		await expect.element(page.getByText(DefaultOverlay.args.defaultValue + 'abc')).toBeInTheDocument()
	})

	it('appear a overlay component by trigger', async () => {
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
		const element = editableText(container)
		await focusAtEnd(element)
		await userEvent.keyboard('@')

		// Overlay should appear with the data item
		await expect.element(page.getByText('Item')).toBeInTheDocument()
	})

	it('reopen overlay after closing', async () => {
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

		const element = editableText(container)
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

	it('probe the trigger against the current generation when controlled and echoed', async () => {
		const {container} = await render(<EchoingParent />)

		const element = editableText(container)
		await focusAtEnd(element)

		// 1. The trigger itself opens the overlay, unfiltered.
		await userEvent.keyboard('@')
		await expect.element(page.getByText('First')).toBeInTheDocument()
		await expect.element(page.getByText('Second')).toBeInTheDocument()

		// 2. The next character filters it — the assertion the stale probe fails, because it
		// matched '@' with an empty word while the tree already held '@f'.
		await userEvent.keyboard('f')
		await expect.element(page.getByText('First')).toBeInTheDocument()
		await expect.element(page.getByText('Second')).not.toBeInTheDocument()

		// 3. Backspace walks it back to the unfiltered list.
		await userEvent.keyboard('{Backspace}')
		await expect.element(page.getByText('Second')).toBeInTheDocument()

		// 4. Deleting the trigger closes it.
		await userEvent.keyboard('{Backspace}')
		await expect.element(page.getByText('First')).not.toBeInTheDocument()
	})

	it('convert selection to mark token, not raw annotation', async () => {
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

		const element = editableText(container)
		await focusAtEnd(element)
		await userEvent.keyboard('@')
		await expect.element(page.getByText('Item')).toBeInTheDocument()

		// Select the item from overlay
		await page.getByText('Item').click()

		// The selected value should render as a <mark> element, not raw annotation text
		await expect.element(page.getByRole('mark')).toBeInTheDocument()
	})

	it('restore focus after selection from overlay', async () => {
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

		const editableContainer = container.querySelector<HTMLElement>('div')!
		const middleSpan = editableText(container, 1)
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