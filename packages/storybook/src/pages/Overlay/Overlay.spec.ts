import type {Markup} from '@markput/core'
import {describe, expect, it} from 'vitest'
import {page, userEvent} from 'vitest/browser'

import {textSurfaces} from '../../shared/lib/dom'
import {focusAtEnd, verifyCaretPosition} from '../../shared/lib/focus'
import {composePage, mount} from '../../shared/lib/page'
import * as BaseStories from '../Base/Base.stories'
import {EchoingParent} from './Overlay.fixtures'
import * as OverlayStories from './Overlay.stories'

const {Default} = composePage(BaseStories)
const {DefaultOverlay} = composePage(OverlayStories)

const LABELLED_ITEM = [
	{
		markup: '@[__label__](__value__)' as Markup,
		overlay: {
			trigger: '@',
			data: ['Item'],
		},
	},
]

const VALUED_ITEM = [
	{
		markup: '@[__value__](__meta__)' as Markup,
		overlay: {
			trigger: '@',
			data: ['Item'],
		},
	},
]

describe('API: Overlay and Triggers', () => {
	it('work with empty options array', async () => {
		const {host} = await mount(DefaultOverlay, {options: []})
		const [surface] = textSurfaces(host)

		await focusAtEnd(surface)
		await userEvent.keyboard('abc')

		await expect.element(page.getByText(DefaultOverlay.args.defaultValue! + 'abc')).toBeInTheDocument()
	})

	it('typed with default values of options', async () => {
		const {host} = await mount(DefaultOverlay)
		const [surface] = textSurfaces(host)

		await focusAtEnd(surface)
		await userEvent.keyboard('abc')

		await expect.element(page.getByText(DefaultOverlay.args.defaultValue! + 'abc')).toBeInTheDocument()
	})

	it('appear a overlay component by trigger', async () => {
		const {host} = await mount(Default, {defaultValue: 'Hello ', options: LABELLED_ITEM})

		// Focus and type the trigger character to show overlay
		const [surface] = textSurfaces(host)
		await focusAtEnd(surface)
		await userEvent.keyboard('@')

		// Overlay should appear with the data item
		await expect.element(page.getByText('Item')).toBeInTheDocument()
	})

	it('reopen overlay after closing', async () => {
		const {host} = await mount(Default, {defaultValue: 'Hello ', options: LABELLED_ITEM})
		const [surface] = textSurfaces(host)

		await focusAtEnd(surface)

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

	/**
	 * `EchoingParent` is CONTROLLED and echoes `onChange` straight back into `value`. Every
	 * other overlay case here is uncontrolled, which is the working path — the trigger probe
	 * used to read one generation stale only under this wiring.
	 */
	it('probe the trigger against the current generation when controlled and echoed', async () => {
		const {host} = await mount(EchoingParent)
		const [surface] = textSurfaces(host)

		await focusAtEnd(surface)

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
		const {host} = await mount(Default, {defaultValue: 'Hello ', options: VALUED_ITEM})
		const [surface] = textSurfaces(host)

		await focusAtEnd(surface)
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
		const {host} = await mount(Default, {
			defaultValue: 'Start @[A](0) mid @[B](0) end',
			options: VALUED_ITEM,
		})
		const [, middleSpan] = textSurfaces(host)

		await focusAtEnd(middleSpan)
		await userEvent.keyboard('@')
		await expect.element(page.getByText('Item')).toBeInTheDocument()

		// Select the item from overlay
		await page.getByText('Item').click()

		// After re-parse: [span("Start "), mark("A"), span(" mid "), mark("Item"), span(""), mark("B"), span(" end")]
		// Focus should be on span("") at childIndex + 2 = 4, NOT tail at index 6.
		// Caret position: "Start " (6) + "A" (1) + " mid " (5) + "Item" (4) = 16
		verifyCaretPosition(host, 16)
	})
})