import type {Markup} from '@markput/core'
import {describe, expect, it} from 'vitest'
import {page, userEvent} from 'vitest/browser'

import {getElement, rowsOf, textSurfaces} from '../../shared/lib/dom'
import {focusAtEnd, verifyCaretPosition} from '../../shared/lib/focus'
import {Mark} from '../../shared/lib/marks'
import {composePage, mount, mountEcho} from '../../shared/lib/page'
import * as BaseStories from '../Base/Base.stories'
import * as OverlayStories from './Overlay.stories'

const {Default} = composePage(BaseStories)
const {DefaultOverlay, RowMenu} = composePage(OverlayStories)

const ECHO_OPTIONS = [
	{
		markup: '@[__value__](__meta__)' as Markup,
		overlay: {trigger: '@', data: ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth']},
	},
]

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

/**
 * The overlay BOX around a rendered suggestion — the positioned ancestor, found by the one
 * property that defines it (`position: fixed`) rather than by a CSS-module class name or by
 * counting parents, so it survives markup changes in either adapter.
 */
function overlayBox(inner: HTMLElement): HTMLElement {
	for (let element: HTMLElement | null = inner; element; element = element.parentElement) {
		if (getComputedStyle(element).position === 'fixed') return element
	}
	throw new Error('Expected a fixed-positioned overlay ancestor')
}

function caretRect(): DOMRect {
	const selection = window.getSelection()
	if (!selection?.rangeCount) throw new Error('Expected a caret')
	return selection.getRangeAt(0).getBoundingClientRect()
}

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

	/**
	 * The anchor is measured, not inspected: `left`/`top` on the box against the live caret
	 * rect — the same `getSelection().getRangeAt(0).getBoundingClientRect()` core positions
	 * from. Asserting the inline style instead would pass on a Vue popup that carries
	 * `left: 66` and paints at the host's edge, because a unitless length is dropped by the
	 * CSSOM, which is exactly the defect this pins.
	 *
	 * The typed text before the trigger is what gives the assertion teeth: it puts the caret
	 * ~50px in, so "anchored at the caret" and "anchored at the editor's left edge" — the two
	 * behaviours that differed between the adapters — cannot both satisfy it. The guard below
	 * fails loudly if a future default value stops separating them.
	 */
	/**
	 * The option's own config — `trigger`, `data` — is handed to the overlay component as props.
	 * A component that reads everything from `useOverlay()` declares none of them, and Vue then
	 * spills undeclared props onto its root element as attributes, where React simply drops
	 * them. Nothing depends on the attributes, but the two adapters must render the same DOM.
	 */
	it('keeps the option config off the overlay element', async () => {
		const {host} = await mount(Default, {defaultValue: 'Hello ', options: LABELLED_ITEM})
		const [surface] = textSurfaces(host)

		await focusAtEnd(surface)
		await userEvent.keyboard('@')

		const item = page.getByText('Item')
		await expect.element(item).toBeInTheDocument()

		const overlay = overlayBox(getElement(item))
		expect(overlay.getAttribute('trigger')).toBeNull()
		expect(overlay.getAttribute('data')).toBeNull()
	})

	it('anchor the overlay at the caret, not at the editor edge', async () => {
		const {host} = await mount(Default, {defaultValue: 'Hello ', options: LABELLED_ITEM})
		const [surface] = textSurfaces(host)

		await focusAtEnd(surface)
		await userEvent.keyboard('@')

		const item = page.getByText('Item')
		await expect.element(item).toBeInTheDocument()

		const caret = caretRect()
		const overlay = overlayBox(getElement(item)).getBoundingClientRect()
		const hostLeft = host.getBoundingClientRect().left

		expect(caret.left - hostLeft, 'the caret must be far enough in to tell the two anchors apart').toBeGreaterThan(
			8
		)
		expect(overlay.left).toBeCloseTo(caret.left, 0)
		expect(overlay.top).toBeGreaterThanOrEqual(caret.bottom)
		expect(overlay.top).toBeLessThanOrEqual(caret.bottom + 4)
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
	 * CONTROLLED, echoing `onChange` straight back into `value`. Every other overlay case here
	 * is uncontrolled, which is the working path — the trigger probe used to read one
	 * generation stale only under this wiring.
	 */
	it('probe the trigger against the current generation when controlled and echoed', async () => {
		const {host} = await mountEcho(Default, {
			value: 'calling ',
			Mark,
			options: ECHO_OPTIONS,
		})
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

/**
 * THE ROW MENU, driven through the SHIPPED `RowMenu` in both projects. The probe page that
 * proved ticket 11 is React-only until P12, so without these two the Vue component's `entries`
 * binding, its ref wiring and its click path never ran anywhere.
 *
 * Both cases go through `mountEcho`: a menu writes a row, and the value the editor emits is the
 * only thing that says which of the two gestures it ran.
 */
describe('API: the row menu', () => {
	/** INSERT: the row holds nothing but the trigger, so the kind seeds an empty body. */
	it('start a kind from the menu on an empty row', async () => {
		const {host, value} = await mountEcho(RowMenu, {value: 'Intro\n\n'})

		await focusAtEnd(rowsOf(host).at(-1)!)
		await userEvent.keyboard('/')
		await expect.element(page.getByText('Heading 1')).toBeInTheDocument()

		await page.getByText('Heading 1').click()

		await expect.poll(value).toBe('Intro\n\n# ')
	})

	/**
	 * CONVERT, which is ticket 11: the menu must retype the ROW rather than write over the
	 * trigger's span, so the text the user typed is what the heading holds.
	 */
	it('convert a row that already has text, keeping the text', async () => {
		const {host, value} = await mountEcho(RowMenu, {value: 'Intro\n\nplain row'})

		await focusAtEnd(rowsOf(host).at(-1)!)
		await userEvent.keyboard('/')
		await expect.element(page.getByText('Heading 1')).toBeInTheDocument()

		await page.getByText('Heading 1').click()

		await expect.poll(value).toBe('Intro\n\n# plain row')
	})

	/** The query pass is core's, so a keyword that appears in no label still narrows the list. */
	it('narrow the menu by a keyword that appears in no label', async () => {
		const {host} = await mountEcho(RowMenu, {value: 'Intro\n\nplain row'})

		await focusAtEnd(rowsOf(host).at(-1)!)
		await userEvent.keyboard('/h1')

		await expect.element(page.getByText('Heading 1')).toBeInTheDocument()
		await expect.element(page.getByText('Bulleted list')).not.toBeInTheDocument()
	})
})