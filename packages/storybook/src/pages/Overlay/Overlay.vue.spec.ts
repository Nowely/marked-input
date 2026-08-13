import type {Option} from '@markput/vue'
import {MarkedInput} from '@markput/vue'
import {composeStories} from '@storybook/vue3-vite'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-vue'
import {page, userEvent} from 'vitest/browser'
import {defineComponent, h, ref} from 'vue'

import {textSurfaces} from '../../shared/lib/dom'
import {focusAtEnd, verifyCaretPosition} from '../../shared/lib/focus'
import {withProps} from '../../shared/lib/testUtils.vue'
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
const ECHO_OPTIONS: Option[] = [
	{
		markup: '@[__value__](__meta__)',
		overlay: {trigger: '@', data: SUGGESTIONS},
	},
]

const EchoingParent = defineComponent({
	setup() {
		const value = ref('calling ')
		const Mark = defineComponent({
			props: {value: String},
			setup(props) {
				return () => h('mark', null, props.value)
			},
		})
		return () =>
			h(MarkedInput, {
				Mark,
				value: value.value,
				onChange: (next: string) => {
					value.value = next
				},
				options: ECHO_OPTIONS,
			})
	},
})

describe('API: Overlay and Triggers', () => {
	it('work with empty options array', async () => {
		await render(withProps(DefaultOverlay, {options: []}))

		const element = editableText(document)
		await focusAtEnd(element)
		await userEvent.keyboard('abc')

		await expect.element(page.getByText(DefaultOverlay.args.defaultValue! + 'abc')).toBeInTheDocument()
	})

	it('typed with default values of options', async () => {
		await render(DefaultOverlay)

		const element = editableText(document)
		await focusAtEnd(element)
		await userEvent.keyboard('abc')

		await expect.element(page.getByText(DefaultOverlay.args.defaultValue! + 'abc')).toBeInTheDocument()
	})

	it('appear a overlay component by trigger', async () => {
		const Mark = defineComponent({
			props: {value: String},
			setup(props) {
				return () => h('mark', null, props.value)
			},
		})

		await render(
			withProps(Default, {
				Mark,
				defaultValue: 'Hello ',
				options: [
					{
						markup: '@[__label__](__value__)',
						overlay: {
							trigger: '@',
							data: ['Item'],
						},
					},
				],
			})
		)

		const element = editableText(document)
		await focusAtEnd(element)
		await userEvent.keyboard('@')

		await expect.element(page.getByText('Item')).toBeInTheDocument()
	})

	it('reopen overlay after closing', async () => {
		const Mark = defineComponent({
			props: {value: String},
			setup(props) {
				return () => h('mark', null, props.value)
			},
		})

		await render(
			withProps(Default, {
				Mark,
				defaultValue: 'Hello ',
				options: [
					{
						markup: '@[__label__](__value__)',
						overlay: {
							trigger: '@',
							data: ['Item'],
						},
					},
				],
			})
		)

		const element = editableText(document)
		await focusAtEnd(element)

		await userEvent.keyboard('@')
		await expect.element(page.getByText('Item')).toBeInTheDocument()

		await userEvent.keyboard('{Escape}')
		await expect.element(page.getByText('Item')).not.toBeInTheDocument()

		await userEvent.keyboard(' @')
		await expect.element(page.getByText('Item')).toBeInTheDocument()
	})

	it('probe the trigger against the current generation when controlled and echoed', async () => {
		const {container} = await render(EchoingParent)

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
		const Mark = defineComponent({
			props: {value: String},
			setup(props) {
				return () => h('mark', null, props.value)
			},
		})

		await render(
			withProps(Default, {
				Mark,
				defaultValue: 'Hello ',
				options: [
					{
						markup: '@[__value__](__meta__)',
						overlay: {
							trigger: '@',
							data: ['Item'],
						},
					},
				],
			})
		)

		const element = editableText(document)
		await focusAtEnd(element)
		await userEvent.keyboard('@')
		await expect.element(page.getByText('Item')).toBeInTheDocument()

		await page.getByText('Item').click()

		await expect.element(page.getByRole('mark')).toBeInTheDocument()
	})

	it('restore focus after selection from overlay', async () => {
		const Mark = defineComponent({
			props: {value: String},
			setup(props) {
				return () => h('mark', null, props.value)
			},
		})

		const {container} = await render(
			withProps(Default, {
				Mark,
				defaultValue: 'Start @[A](0) mid @[B](0) end',
				options: [
					{
						markup: '@[__value__](__meta__)',
						overlay: {
							trigger: '@',
							data: ['Item'],
						},
					},
				],
			})
		)

		const editableContainer = container.querySelector<HTMLElement>('div')!
		const middleSpan = editableText(container, 1)
		await focusAtEnd(middleSpan)
		await userEvent.keyboard('@')
		await expect.element(page.getByText('Item')).toBeInTheDocument()

		await page.getByText('Item').click()

		verifyCaretPosition(editableContainer, 16)
	})
})