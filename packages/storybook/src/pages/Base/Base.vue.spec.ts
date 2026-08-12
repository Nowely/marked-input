import type {Markup} from '@markput/vue'
import {MarkedInput, useMark} from '@markput/vue'
import {composeStories} from '@storybook/vue3-vite'
import {describe, expect, it, vi} from 'vitest'
import {render} from 'vitest-browser-vue'
import {page, userEvent} from 'vitest/browser'
import {defineComponent, h, nextTick, provide, ref} from 'vue'

import {Store} from '../../../../core/src/store/Store'
import TokenChildren from '../../../../vue/markput/src/components/TokenChildren.vue'
import {STORE_KEY} from '../../../../vue/markput/src/lib/providers/storeKey'
import {caretIsInside, editingHost, findEditingHost, getElement, textSurfaces} from '../../shared/lib/dom'
import {focusAtEnd, focusAtStart} from '../../shared/lib/focus'
import {withProps} from '../../shared/lib/testUtils.vue'
import * as BaseStories from './Base.vue.stories'

const {Default} = composeStories(BaseStories)

const EDITABLE_MARK_VALUE = 'Hello, @[focusable](By key operations) abbreviation @[world](Hello! Hello!)!'
const REMOVABLE_MARK_VALUE = 'I @[contain]( ) @[removable]( ) by click @[marks]( )!'

describe('Component: MarkedInput', () => {
	it.todo('set readOnly on selection')

	it('renders default text as one bare span inside the editing host', async () => {
		const {container} = await render(withProps(Default, {defaultValue: 'plain'}))
		const editor = container.firstElementChild!
		const [surface] = textSurfaces(editor)

		expect(editor).toHaveAttribute('contenteditable', 'true')
		expect(editor.children).toHaveLength(1)
		expect(editor.firstElementChild).toBe(surface)
		expect(surface).not.toHaveAttribute('contenteditable')
		expect(surface).toHaveTextContent('plain')
	})

	it('renders mark roots without adapter wrappers', async () => {
		const Mark = defineComponent({
			props: {value: String},
			setup(props) {
				return () => h('mark', {'data-testid': 'mark'}, props.value)
			},
		})
		const {container} = await render(withProps(Default, {Mark, defaultValue: 'hello @[world](1)'}))
		const editor = container.firstElementChild!
		const mark = container.querySelector<HTMLElement>('mark[data-testid="mark"]')!

		expect(mark.parentElement).toBe(editor)
		expect(mark).toHaveTextContent('world')
		// Atomic by contract, and NOT a tab stop: Tab leaves the field.
		expect(mark).toHaveAttribute('contenteditable', 'false')
		expect(mark).not.toHaveAttribute('tabindex')
	})

	it('preserves option-provided children for flat mark components', async () => {
		const markup: Markup = '@(__value__)'
		const Mark = defineComponent({
			props: {children: String},
			setup(props) {
				return () => h('mark', {'data-testid': 'mark'}, props.children)
			},
		})
		const {container} = await render(
			withProps(Default, {
				Mark,
				options: [{markup, mark: ({value}: {value?: string}) => ({children: value})}],
				defaultValue: 'hello @(world)',
			})
		)
		const mark = container.querySelector<HTMLElement>('mark[data-testid="mark"]')!

		expect(mark).toHaveTextContent('world')
	})

	it('renders slot text when mark renders an unregistered control before children', async () => {
		const todoMarkup = '- [__value__] __slot__\n' as Markup
		const TodoMark = defineComponent({
			setup(_, {slots}) {
				return () =>
					h('span', {'data-testid': 'todo-mark'}, [
						h('input', {type: 'checkbox', 'aria-label': 'done'}),
						slots.default?.(),
					])
			},
		})

		const {container} = await render(
			withProps(Default, {
				Mark: TodoMark,
				options: [{markup: todoMarkup}],
				defaultValue: '- [ ] Design Phase\n',
			})
		)

		await expect.element(page.getByText('Design Phase')).toBeInTheDocument()
		const textSurface = Array.from(container.querySelectorAll<HTMLElement>('span')).find(
			el => el.textContent === 'Design Phase'
		)!
		// Slot text stays in the ONE host: bare, with the container as its editing host. Only
		// the mark's own chrome — the checkbox — is frozen non-editable.
		expect(textSurface).not.toHaveAttribute('contenteditable')
		expect(editingHost(textSurface)).toBe(container.firstElementChild)
		expect(getElement(page.getByLabelText('done'))).toHaveAttribute('contenteditable', 'false')

		await userEvent.click(getElement(page.getByLabelText('done')))

		expect(textSurface).toHaveTextContent('Design Phase')
	})

	it('refreshes child sequence registration when the owner id changes', async () => {
		// Owner identity is the mark's stable id since S1.8 step 4, not its TokenPath. The
		// re-registration contract is unchanged: the old ref is released with `null` before
		// the new one is handed the element.
		const callbacks = new Map<number, ReturnType<typeof vi.fn>>()
		const store = new Store()
		vi.spyOn(store.tokens, 'children').mockImplementation((ownerId: number) => {
			const callback = vi.fn()
			callbacks.set(ownerId, callback)
			return callback
		})
		const Harness = defineComponent({
			setup() {
				provide(STORE_KEY, store)
				const ownerId = ref(7)
				return () =>
					h('div', [
						h('button', {onClick: () => (ownerId.value = 8)}, 'move'),
						h(TokenChildren, {ownerId: ownerId.value}, () => h('span', 'child')),
					])
			},
		})

		await render(Harness)
		const initialCallback = callbacks.get(7)
		expect(initialCallback).toHaveBeenCalledWith(expect.any(HTMLElement))

		await userEvent.click(getElement(page.getByRole('button', {name: 'move'})))
		await nextTick()

		expect(initialCallback).toHaveBeenLastCalledWith(null)
		expect(callbacks.get(8)).toHaveBeenCalledWith(expect.any(HTMLElement))
	})

	it('correctly process an annotation type', async () => {
		const Mark = defineComponent({
			props: {value: String, meta: String},
			setup(props) {
				return () => h('mark', null, props.value)
			},
		})

		const {container} = await render(withProps(Default, {Mark, defaultValue: ''}))

		const editor = findEditingHost(container)
		const [span] = textSurfaces(editor)
		await expect.element(span).toHaveTextContent('')

		// Typed at the HOST: an empty text token renders a zero-size bare span, which is not
		// a click target any more — the container is where the caret and the keys land.
		await userEvent.type(editor, '@[[mark](1)')

		await expect.element(page.getByText('mark')).toBeInTheDocument()
	})

	const FocusableMark = defineComponent({
		setup() {
			const mark = useMark()

			return () =>
				h(
					'abbr',
					{
						title: mark.meta(),
						style: {
							outline: 'none',
							whiteSpace: 'pre-wrap',
						},
					},
					mark.value()
				)
		},
	})

	const RemovableMark = defineComponent({
		setup() {
			const mark = useMark()
			return () => h('mark', {onClick: () => mark.remove()}, mark.value())
		},
	})

	it('walks the caret across mark tokens with the arrow keys', async () => {
		const {container} = await render(
			withProps(Default, {
				Mark: FocusableMark,
				value: EDITABLE_MARK_VALUE,
			})
		)

		const editor = findEditingHost(container)
		const [firstSpan, secondSpan, thirdSpan] = textSurfaces(editor)
		const [firstAbbr] = container.querySelectorAll('abbr')

		await focusAtStart(firstSpan)

		// Marks are atomic and NOT focus targets: crossing one is a single keystroke that
		// moves the CARET from the position before the mark to the position after it.
		await userEvent.keyboard(`{ArrowRight>${firstSpan.textContent.length}/}`)
		expect(caretIsInside(firstSpan)).toBe(true)
		expect(firstAbbr).toHaveAttribute('contenteditable', 'false')

		await userEvent.keyboard('{ArrowRight}')
		expect(caretIsInside(secondSpan)).toBe(true)

		await userEvent.keyboard('{ArrowLeft}')
		expect(caretIsInside(firstSpan)).toBe(true)

		await userEvent.keyboard(`{ArrowRight>${secondSpan.textContent.length + 1}/}`)
		expect(caretIsInside(secondSpan)).toBe(true)

		await userEvent.keyboard('{ArrowRight}')
		expect(caretIsInside(thirdSpan)).toBe(true)

		// Focus never moved: the container is the one host for the whole walk.
		await expect.element(editor).toHaveFocus()
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
				return () => h('mark', {onClick: () => mark.update({value: `${mark.value()}1`})}, mark.value())
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
		const [span] = textSurfaces(container.firstElementChild!)

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
				return () => h('mark', {onClick: () => mark.remove()}, mark.value())
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
						markup: '@[__value__](__meta__)' as Markup,
						overlay: {trigger: '@', data: ['Alice']},
					},
				],
			})
		)
		const [span] = textSurfaces(container.firstElementChild!)

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
		await expect.element(editingHost(getElement(span))).toHaveFocus()

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