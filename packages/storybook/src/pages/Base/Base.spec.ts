import type {Markup} from '@markput/core'
import {describe, expect, it, vi} from 'vitest'
import {page, userEvent} from 'vitest/browser'

import {caretIsInside, editingHost, findEditingHost, getElement, textSurfaces} from '../../shared/lib/dom'
import {focusAtEnd, focusAtOffset, focusAtStart} from '../../shared/lib/focus'
import {defineMark, Empty, Focusable, Mark, Removable} from '../../shared/lib/marks'
import {composePage, mount, mountComponent, mountEcho} from '../../shared/lib/page'
import {marks, Overlay} from './Base.fixtures'
import * as BaseStories from './Base.stories'

const {Configured, Default} = composePage(BaseStories)

const EDITABLE_MARK_VALUE = 'Hello, @[focusable](By key operations) abbreviation @[world](Hello! Hello!)!'
/** Appends to its own value on click, through the node the mark context carries. */
const Updatable = defineMark({tag: 'mark', on: {click: ({mark}) => mark.update({value: `${mark.value()}1`})}})

const REMOVABLE_MARK_VALUE = 'I @[contain]( ) @[removable]( ) by click @[marks]( )!'

describe('Component: MarkedInput', () => {
	it.todo('set readOnly on selection')

	it('renders default text as one bare span inside the editing host', async () => {
		const {host} = await mount(Default, {defaultValue: 'plain'})
		const [surface] = textSurfaces(host)

		expect(host).toHaveAttribute('contenteditable', 'true')
		expect(host.children).toHaveLength(1)
		expect(host.firstElementChild).toBe(surface)
		expect(surface).not.toHaveAttribute('contenteditable')
		expect(surface).toHaveTextContent('plain')
	})

	it('wraps a mark root in one box-less element and leaves the consumer’s own element alone', async () => {
		// CHANGED CONTRACT. This used to assert `mark.parentElement === host` — that markput
		// interposes nothing. It now interposes exactly one element, and that is the point: a
		// Mark's element belongs to the CONSUMER, who may pass a third-party component straight
		// through, so core cannot demand a ref on it and must not write attributes onto it.
		// The wrapper carries both instead.
		//
		// It costs no layout: `display: contents` generates no box, measured identical to no
		// wrapper across inline, block, list and flex/grid shapes.
		const {host} = await mount(Default, {Mark, defaultValue: 'hello @[world](1)'})
		const mark = host.querySelector('mark')!
		const wrapper = mark.parentElement!

		expect(wrapper.parentElement).toBe(host)
		expect(wrapper.tagName).toBe('SPAN')
		expect(wrapper.style.display).toBe('contents')
		expect(mark).toHaveTextContent('world')

		// Atomic by contract, and NOT a tab stop: Tab leaves the field. Both now live on the
		// wrapper; the consumer's element carries neither.
		expect(wrapper).toHaveAttribute('contenteditable', 'false')
		expect(wrapper).not.toHaveAttribute('tabindex')
		expect(mark).not.toHaveAttribute('contenteditable')
	})

	it('preserves option-provided children for flat mark components', async () => {
		const markup = '@(__value__)' as Markup
		const {host} = await mount(Default, {
			Mark,
			options: [{markup, mark: ({value}: {value?: string}) => ({children: value})}],
			defaultValue: 'hello @(world)',
		})
		const mark = host.querySelector('mark')!

		expect(mark).toHaveTextContent('world')
	})

	it('renders slot text when mark renders an unregistered control before children', async () => {
		const todoMarkup = '- [__value__] __slot__\n' as Markup
		const {host} = await mount(Default, {
			Mark: marks.Todo,
			options: [{markup: todoMarkup}],
			defaultValue: '- [ ] Design Phase\n',
		})

		await expect.element(page.getByText('Design Phase')).toBeInTheDocument()
		const textSurface = Array.from(host.querySelectorAll<HTMLElement>('span')).find(
			el => el.textContent === 'Design Phase'
		)!
		// Slot text stays in the ONE host: bare, with the container as its editing host. Only
		// the mark's own control — the checkbox — is frozen non-editable.
		expect(textSurface).not.toHaveAttribute('contenteditable')
		expect(editingHost(textSurface)).toBe(host)
		expect(getElement(page.getByLabelText('done'))).toHaveAttribute('contenteditable', 'false')

		await userEvent.click(getElement(page.getByLabelText('done')))

		expect(textSurface).toHaveTextContent('Design Phase')
	})

	it('correctly process an annotation type', async () => {
		const {host} = await mount(Default, {Mark, defaultValue: ''})
		const [span] = textSurfaces(host)

		await expect.element(span).toBeInTheDocument()

		// Typed at the HOST: an empty text token renders a zero-size bare span, which is not
		// a click target any more — the container is where the caret and the keys land.
		await userEvent.type(host, '@[[mark](1)')

		await expect.element(page.getByText('@[mark](1)')).not.toBeInTheDocument()
		await expect.element(page.getByText('mark')).toBeInTheDocument()
	})

	it('walks the caret across mark tokens with the arrow keys', async () => {
		const {host} = await mount(Default, {Mark: Focusable, value: EDITABLE_MARK_VALUE})
		const [firstSpan, secondSpan, thirdSpan] = textSurfaces(host)
		const [firstAbbr] = host.querySelectorAll('abbr')

		await focusAtStart(firstSpan)

		// Marks are atomic and NOT focus targets: crossing one is a single keystroke that
		// moves the CARET from the position before the mark to the position after it.
		await userEvent.keyboard(`{ArrowRight>${firstSpan.textContent.length}/}`)
		expect(caretIsInside(firstSpan)).toBe(true)
		// Atomicity lives on the WRAPPER now, not on the consumer's element — the caret behaviour
		// asserted below is unchanged by that, which is the whole point of the move.
		expect(firstAbbr.parentElement).toHaveAttribute('contenteditable', 'false')

		await userEvent.keyboard('{ArrowRight}')
		expect(caretIsInside(secondSpan)).toBe(true)

		await userEvent.keyboard('{ArrowLeft}')
		expect(caretIsInside(firstSpan)).toBe(true)

		await userEvent.keyboard(`{ArrowRight>${secondSpan.textContent.length + 1}/}`)
		expect(caretIsInside(secondSpan)).toBe(true)

		await userEvent.keyboard('{ArrowRight}')
		expect(caretIsInside(thirdSpan)).toBe(true)

		// Focus never moved: the container is the one host for the whole walk.
		await expect.element(host).toHaveFocus()
	})

	it('support remove itself', async () => {
		await mountEcho(Default, {Mark: Removable, value: REMOVABLE_MARK_VALUE})

		let mark = page.getByText('contain')
		await userEvent.click(mark)
		await expect.element(page.getByText('contain')).not.toBeInTheDocument()

		mark = page.getByText('marks')
		await userEvent.click(mark)
		await expect.element(page.getByText('marks')).not.toBeInTheDocument()
	})

	it('support mark controller updates', async () => {
		const {value} = await mountEcho(Default, {Mark: Updatable, value: EDITABLE_MARK_VALUE})

		await userEvent.click(page.getByText('world').first())

		await expect.element(page.getByText('world1').first()).toBeInTheDocument()
		await expect.poll(value).toContain('@[world1](Hello! Hello!)')
	})

	it('keeps controlled span input unchanged until value is echoed', async () => {
		const onChange = vi.fn()
		const {host} = await mount(Default, {Mark, value: 'Hello @[world](1)', onChange})
		const [span] = textSurfaces(host)

		await focusAtEnd(span)
		await userEvent.keyboard('!')

		expect(onChange).toHaveBeenCalledWith('Hello !@[world](1)')
		expect(span.textContent).toBe('Hello ')
	})

	it('keeps controlled mark visible after removal until value is echoed', async () => {
		const onChange = vi.fn()
		const {host} = await mount(Default, {Mark: Removable, value: 'Hello @[world](1)', onChange})
		const mark = host.querySelector<HTMLElement>('mark')!

		await userEvent.click(mark)

		expect(onChange).toHaveBeenCalledWith('Hello ')
		expect(host.querySelector('mark')?.textContent).toBe('world')
	})

	it('keeps controlled overlay selection text unchanged until value is echoed', async () => {
		const onChange = vi.fn()
		const {host} = await mount(Default, {
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
		const [span] = textSurfaces(host)

		await focusAtEnd(span)
		await userEvent.keyboard('{ArrowRight}')
		await page.getByText('Alice').click()

		expect(onChange).toHaveBeenCalledWith('Hello @[Alice](0)')
		expect(span.textContent).toBe('Hello @')
	})

	it('support to pass a forward overlay', async () => {
		await mount(Default, {
			Mark: Empty,
			Overlay,
			showOverlayOn: 'selectionChange',
			defaultValue: 'Hello @',
		})

		const span = page.getByText(/hello/i)
		await focusAtEnd(getElement(span))
		await userEvent.keyboard('{ArrowRight}')
		await expect.element(editingHost(getElement(span))).toHaveFocus()

		await expect.element(page.getByText("I'm here!")).toBeInTheDocument()
	})

	it('not create empty mark when pressing Enter in overlay without selection', async () => {
		await mount(Default, {
			Mark,
			options: [
				{
					markup: '@[__value__](test:__meta__)' as Markup,
					overlay: {trigger: '@', data: ['one', 'two', 'three']},
				},
			],
			defaultValue: 'Hello @',
		})

		const span = page.getByText(/hello/i)
		await focusAtEnd(getElement(span))
		await userEvent.keyboard('{ArrowRight}')
		await userEvent.keyboard('{Enter}')

		await expect.element(page.getByText('one')).not.toBeInTheDocument()
		await expect.element(page.getByText('two')).not.toBeInTheDocument()
		await expect.element(page.getByText('three')).not.toBeInTheDocument()
	})

	it('edits a story whose value the plain-value panel owns', async () => {
		// `Configured` is controlled and opts into the panel, so `withPlainValue` owns its
		// `value`/`onChange`. The decorated story must still edit like any other: the editor
		// patches in place — a remount would drop the content, the caret and the focus — and
		// the panel tracks the new value.
		const {host} = await mount(Configured)
		const [firstSpan] = textSurfaces(host)

		await focusAtOffset(firstSpan, 5)
		await userEvent.keyboard('X')

		expect(host).toHaveTextContent(/^EnterX the/)
		expect(findEditingHost(document.body)).toBe(host)
		await expect.element(host).toHaveFocus()
		expect(caretIsInside(textSurfaces(host)[0])).toBe(true)

		const panel = document.querySelector('pre[data-value]')
		expect(panel?.getAttribute('data-value')).toContain("EnterX the '@' for calling @[primary](primary:4)")
	})

	it('reverts a prop to its default when the caller stops passing it', async () => {
		// The adapter owes core a FULL sync on every render: `readOnly` that disappears between
		// renders must revert to its default, not keep the value it last had.
		const {host, rerender} = await mountComponent({
			separator: null,
			Mark,
			defaultValue: 'hello @[x](1)',
			readOnly: true,
		})
		expect(host).toHaveAttribute('contenteditable', 'false')

		// The same mount with `readOnly` simply ABSENT — the shape a tabbed story has.
		const unlocked = await rerender({Mark, defaultValue: 'hello @[x](1)'})

		expect(unlocked).toHaveAttribute('contenteditable', 'true')
	})

	it.todo('be selectable')
})