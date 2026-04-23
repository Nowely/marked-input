// oxlint-disable typescript-eslint/no-unsafe-argument
import type {Markup} from '@markput/vue'
import {useMark} from '@markput/vue'
import {composeStories} from '@storybook/vue3-vite'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-vue'
import {page, userEvent} from 'vitest/browser'
import {defineComponent, h, onMounted, ref, type ComponentPublicInstance} from 'vue'

import {getElement} from '../../shared/lib/dom'
import {focusAtEnd, focusAtStart} from '../../shared/lib/focus'
import {withProps} from '../../shared/lib/testUtils.vue'
import * as BaseStories from './Base.vue.stories'

const {Default} = composeStories(BaseStories)

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

		const [span] = container.querySelectorAll('span')
		await expect.element(span).toHaveTextContent('')

		await userEvent.type(span, '@[[mark](1)')

		await expect.element(page.getByText('mark')).toBeInTheDocument()
	})

	const FocusableMark = defineComponent({
		setup() {
			const mark = useMark({controlled: true})
			const elRef = ref<HTMLElement | null>(null)

			onMounted(() => {
				if (elRef.value) elRef.value.textContent = mark.value ?? null
			})

			return () =>
				h('abbr', {
					ref: (el: Element | ComponentPublicInstance | null) => {
						// oxlint-disable-next-line no-unsafe-type-assertion
						elRef.value = el as HTMLElement | null
						// oxlint-disable-next-line no-unsafe-type-assertion
						mark.ref.current = el as HTMLElement | null
					},
					title: mark.meta,
					contentEditable: true,
					style: {
						outline: 'none',
						whiteSpace: 'pre-wrap',
					},
				})
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

		const spans = document.querySelectorAll<HTMLElement>('span[contenteditable]')
		const [firstSpan, secondSpan] = Array.from(spans)
		const abbrs = document.querySelectorAll('abbr')
		const [firstAbbr] = Array.from(abbrs)
		const firstSpanLength = firstSpan.textContent.length
		const firstAbbrLength = firstAbbr.textContent.length

		await focusAtStart(firstSpan)
		await expect.element(firstSpan).toHaveFocus()

		await userEvent.keyboard(`{ArrowRight>${firstSpanLength + 1}/}`)
		await expect.element(firstAbbr).toHaveFocus()

		await userEvent.keyboard(`{ArrowLeft>2/}`)
		await expect.element(firstSpan).toHaveFocus()

		await userEvent.keyboard(`{ArrowRight>2/}`)
		await expect.element(firstAbbr).toHaveFocus()

		await userEvent.keyboard(`{ArrowRight>${firstAbbrLength + 1}/}`)
		await expect.element(secondSpan).toHaveFocus()
	})

	it('support remove itself', async () => {
		await render(
			withProps(Default, {
				Mark: RemovableMark,
				value: 'I @[contain]( ) @[removable]( ) by click @[marks]( )!',
			})
		)

		let mark = page.getByText('contain')
		await userEvent.click(mark)
		await expect.element(page.getByText('contain')).not.toBeInTheDocument()

		mark = page.getByText('marks')
		await userEvent.click(mark)
		await expect.element(page.getByText('marks')).not.toBeInTheDocument()
	})

	it('support editable marks', async () => {
		await render(
			withProps(Default, {
				Mark: FocusableMark,
				value: 'Hello, @[focusable](By key operations) abbreviation @[world](Hello! Hello!)!',
			})
		)

		const worldElement = getElement(page.getByText('world').first())
		await focusAtEnd(worldElement)
		await userEvent.keyboard('123')

		await expect.element(page.getByText('world123').first()).toBeInTheDocument()
		await expect.element(page.getByTitle('Hello! Hello!')).toHaveTextContent('world123')
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