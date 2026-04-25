// oxlint-disable typescript-eslint/no-unsafe-argument
import type {Markup} from '@markput/vue'
import {MarkedInput, useMark} from '@markput/vue'
import {composeStories} from '@storybook/vue3-vite'
import {describe, expect, it, vi} from 'vitest'
import {render} from 'vitest-browser-vue'
import {page, userEvent} from 'vitest/browser'
import {defineComponent, h, ref} from 'vue'

import {getElement} from '../../shared/lib/dom'
import {focusAtEnd, focusAtStart} from '../../shared/lib/focus'
import {withProps} from '../../shared/lib/testUtils.vue'
import * as BaseStories from './Base.vue.stories'

const {Default} = composeStories(BaseStories)

const EDITABLE_MARK_VALUE = 'Hello, @[focusable](By key operations) abbreviation @[world](Hello! Hello!)!'
const REMOVABLE_MARK_VALUE = 'I @[contain]( ) @[removable]( ) by click @[marks]( )!'

function getMarkFocusTarget(element: Element): HTMLElement {
	const target = element.closest<HTMLElement>('span[tabindex]')
	if (!target) throw new Error('Expected mark token focus target')
	return target
}

describe('Component: MarkedInput', () => {
	it.todo('set readOnly on selection')

	it('correctly process an annotation type', async () => {
		const Mark = defineComponent({
			props: {value: String, meta: String},
			setup(props) {
				return () => h('mark', null, props.value)
			},
		})

		const {container} = await render(withProps(Default, {Mark, defaultValue: ''}))

		const span = container.querySelector<HTMLElement>('span[contenteditable]')!
		await expect.element(span).toHaveTextContent('')

		await userEvent.type(span, '@[[mark](1)')

		await expect.element(page.getByText('mark')).toBeInTheDocument()
	})

	const FocusableMark = defineComponent({
		setup() {
			const mark = useMark()

			return () =>
				h(
					'abbr',
					{
						title: mark.meta,
						style: {
							outline: 'none',
							whiteSpace: 'pre-wrap',
						},
					},
					mark.value
				)
		},
	})

	const RemovableMark = defineComponent({
		setup() {
			const mark = useMark()
			return () => h('mark', {onClick: () => mark.remove()}, mark.value)
		},
	})

	it('support ref focusing target', async () => {
		await render(
			withProps(Default, {
				Mark: FocusableMark,
				value: 'Hello, @[focusable](By key operations) abbreviation @[world](Hello! Hello!)!',
			})
		)

		const [firstSpan, secondSpan] = Array.from(document.querySelectorAll<HTMLElement>('span[contenteditable]'))
		const abbrs = document.querySelectorAll('abbr')
		const [firstAbbr] = Array.from(abbrs)
		const firstAbbrFocusTarget = getMarkFocusTarget(firstAbbr)
		const firstSpanLength = firstSpan.textContent.length

		await focusAtStart(firstSpan)
		await expect.element(firstSpan).toHaveFocus()

		await userEvent.keyboard(`{ArrowRight>${firstSpanLength + 1}/}`)
		await expect.element(firstAbbrFocusTarget).toHaveFocus()

		await userEvent.keyboard('{ArrowLeft}')
		await expect.element(firstSpan).toHaveFocus()

		await userEvent.keyboard('{ArrowRight}')
		await expect.element(firstAbbrFocusTarget).toHaveFocus()

		await userEvent.keyboard('{ArrowRight}')
		await expect.element(secondSpan).toHaveFocus()
	})

	it('support remove itself', async () => {
		const EchoRemovable = defineComponent({
			setup() {
				const value = ref(REMOVABLE_MARK_VALUE)
				return () =>
					h(MarkedInput, {
						Mark: RemovableMark,
						value: value.value,
						onChange: (v: string) => {
							value.value = v
						},
					})
			},
		})

		await render(EchoRemovable)

		let mark = page.getByText('contain')
		await userEvent.click(mark)
		await expect.element(page.getByText('contain')).not.toBeInTheDocument()

		mark = page.getByText('marks')
		await userEvent.click(mark)
		await expect.element(page.getByText('marks')).not.toBeInTheDocument()
	})

	it('support mark controller updates', async () => {
		const UpdatableMark = defineComponent({
			setup() {
				const mark = useMark()
				return () => h('mark', {onClick: () => mark.update({value: `${mark.value}1`})}, mark.value)
			},
		})

		const EchoUpdatable = defineComponent({
			setup() {
				const value = ref(EDITABLE_MARK_VALUE)
				return () =>
					h('div', [
						h(MarkedInput, {
							Mark: UpdatableMark,
							value: value.value,
							onChange: (v: string) => {
								value.value = v
							},
						}),
						h('pre', value.value),
					])
			},
		})

		await render(EchoUpdatable)

		await userEvent.click(page.getByText('world').first())

		await expect.element(page.getByText('world1').first()).toBeInTheDocument()
		await expect.element(page.getByText(/@\[world1]\(Hello! Hello!\)/)).toBeInTheDocument()
	})

	it('keeps controlled span input unchanged until value is echoed', async () => {
		const onChange = vi.fn()
		const Mark = defineComponent({
			props: {value: String},
			setup(props) {
				return () => h('mark', null, props.value)
			},
		})
		const {container} = await render(withProps(Default, {Mark, value: 'Hello @[world](1)', onChange}))
		const [span] = container.querySelectorAll<HTMLElement>('span[contenteditable]')

		await focusAtEnd(span)
		await userEvent.keyboard('!')

		expect(onChange).toHaveBeenCalledWith('Hello !@[world](1)')
		expect(span.textContent).toBe('Hello ')
	})

	it('keeps controlled mark visible after removal until value is echoed', async () => {
		const onChange = vi.fn()
		const Mark = defineComponent({
			setup() {
				const mark = useMark()
				return () => h('mark', {onClick: () => mark.remove()}, mark.value)
			},
		})
		const {container} = await render(withProps(Default, {Mark, value: 'Hello @[world](1)', onChange}))
		const mark = container.querySelector<HTMLElement>('mark')!

		await userEvent.click(mark)

		expect(onChange).toHaveBeenCalledWith('Hello ')
		expect(container.querySelector('mark')?.textContent).toBe('world')
	})

	it('keeps controlled overlay selection text unchanged until value is echoed', async () => {
		const onChange = vi.fn()
		const Mark = defineComponent({
			props: {value: String},
			setup(props) {
				return () => h('mark', null, props.value)
			},
		})
		const {container} = await render(
			withProps(Default, {
				Mark,
				value: 'Hello @',
				onChange,
				showOverlayOn: 'selectionChange',
				options: [
					{
						// oxlint-disable-next-line no-unsafe-type-assertion
						markup: '@[__value__](__meta__)' as Markup,
						overlay: {trigger: '@', data: ['Alice']},
					},
				],
			})
		)
		const [span] = container.querySelectorAll<HTMLElement>('span[contenteditable]')

		await focusAtEnd(span)
		await userEvent.keyboard('{ArrowRight}')
		await page.getByText('Alice').click()

		expect(onChange).toHaveBeenCalledWith('Hello @[Alice](0)')
		expect(span.textContent).toBe('Hello @')
	})

	it('support to pass a forward overlay', async () => {
		const Overlay = defineComponent({
			setup() {
				return () => h('span', null, "I'm here!")
			},
		})

		await render(
			withProps(Default, {
				Mark: defineComponent({setup: () => () => null}),
				Overlay,
				showOverlayOn: 'selectionChange',
				defaultValue: 'Hello @',
			})
		)

		const span = page.getByText(/hello/i)
		await focusAtEnd(getElement(span))
		await userEvent.keyboard('{ArrowRight}')
		await expect.element(span).toHaveFocus()

		await expect.element(page.getByText("I'm here!")).toBeInTheDocument()
	})

	it('not create empty mark when pressing Enter in overlay without selection', async () => {
		const Mark = defineComponent({
			props: {value: String},
			setup(props) {
				return () => h('mark', null, props.value)
			},
		})

		await render(
			withProps(Default, {
				Mark,
				options: [
					{
						// oxlint-disable-next-line no-unsafe-type-assertion
						markup: '@[__value__](test:__meta__)' as Markup,
						overlay: {trigger: '@', data: ['one', 'two', 'three']},
					},
				],
				defaultValue: 'Hello @',
			})
		)

		const span = page.getByText(/hello/i)
		await focusAtEnd(getElement(span))
		await userEvent.keyboard('{ArrowRight}')
		await userEvent.keyboard('{Enter}')

		await expect.element(page.getByText('one')).not.toBeInTheDocument()
		await expect.element(page.getByText('two')).not.toBeInTheDocument()
		await expect.element(page.getByText('three')).not.toBeInTheDocument()
	})

	it.todo('be selectable')
})