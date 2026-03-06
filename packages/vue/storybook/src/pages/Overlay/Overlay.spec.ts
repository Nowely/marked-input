import {composeStories} from '@storybook/vue3-vite'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-vue'
import {page, userEvent} from 'vitest/browser'
import {defineComponent, h} from 'vue'

import {focusAtEnd, verifyCaretPosition} from '../../shared/lib/focus'
import {withProps} from '../../shared/lib/testUtils'
import * as BaseStories from '../Base/Base.stories'
import * as OverlayStories from './Overlay.stories'

const {Default} = composeStories(BaseStories)
const {DefaultOverlay} = composeStories(OverlayStories)

describe('API: Overlay and Triggers', () => {
	it('should work with empty options array', async () => {
		await render(withProps(DefaultOverlay, {options: []}))

		const element = document.querySelector('span[contenteditable]') as HTMLElement
		await focusAtEnd(element)
		await userEvent.keyboard('abc')

		await expect.element(page.getByText(/abc$/)).toBeInTheDocument()
	})

	it('should typed with default values of options', async () => {
		await render(DefaultOverlay)

		const element = document.querySelector('span[contenteditable]') as HTMLElement
		await focusAtEnd(element)
		await userEvent.keyboard('abc')

		await expect.element(page.getByText(/abc$/)).toBeInTheDocument()
	})

	it('should appear a overlay component by trigger', async () => {
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

		const element = document.querySelector('span[contenteditable]') as HTMLElement
		await focusAtEnd(element)
		await userEvent.keyboard('@')

		await expect.element(page.getByText('Item')).toBeInTheDocument()
	})

	it('should reopen overlay after closing', async () => {
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

		const element = document.querySelector('span[contenteditable]') as HTMLElement
		await focusAtEnd(element)

		await userEvent.keyboard('@')
		await expect.element(page.getByText('Item')).toBeInTheDocument()

		await userEvent.keyboard('{Escape}')
		await expect.element(page.getByText('Item')).not.toBeInTheDocument()

		await userEvent.keyboard(' @')
		await expect.element(page.getByText('Item')).toBeInTheDocument()
	})

	it('should convert selection to mark token, not raw annotation', async () => {
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

		const element = document.querySelector('span[contenteditable]') as HTMLElement
		await focusAtEnd(element)
		await userEvent.keyboard('@')
		await expect.element(page.getByText('Item')).toBeInTheDocument()

		await page.getByText('Item').click()

		await expect.element(page.getByRole('mark')).toBeInTheDocument()
	})

	it('should restore focus after selection from overlay', async () => {
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

		const editableContainer = container.firstElementChild as HTMLElement
		const middleSpan = editableContainer.children[2] as HTMLElement
		await focusAtEnd(middleSpan)
		await userEvent.keyboard('@')
		await expect.element(page.getByText('Item')).toBeInTheDocument()

		await page.getByText('Item').click()

		verifyCaretPosition(editableContainer, 16)
	})
})