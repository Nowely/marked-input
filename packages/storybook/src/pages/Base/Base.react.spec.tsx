import type {Markup} from '@markput/react'
import {MarkedInput, useMark} from '@markput/react'
import {composeStories} from '@storybook/react-vite'
import {useState} from 'react'
import {describe, expect, it, vi} from 'vitest'
import {render} from 'vitest-browser-react'
import {page, userEvent} from 'vitest/browser'

import {getElement} from '../../shared/lib/dom'
import {focusAtEnd, focusAtStart} from '../../shared/lib/focus'
import * as DynamicStories from '../Dynamic/Dynamic.react.stories'
import * as BaseStories from './Base.react.stories'

const {Default} = composeStories(BaseStories)
const {Focusable, Removable} = composeStories(DynamicStories)

const EDITABLE_MARK_VALUE = 'Hello, @[focusable](By key operations) abbreviation @[world](Hello! Hello!)!'
const REMOVABLE_MARK_VALUE = 'I @[contain]( ) @[removable]( ) by click @[marks]( )!'

function EchoRemovable() {
	const [value, setValue] = useState(REMOVABLE_MARK_VALUE)
	return <Removable value={value} onChange={setValue} />
}

function EchoUpdatable() {
	const [value, setValue] = useState(EDITABLE_MARK_VALUE)

	function UpdatableMark() {
		const mark = useMark()
		return <mark onClick={() => mark.update({value: `${mark.value}1`})}>{mark.value}</mark>
	}

	return (
		<>
			<MarkedInput Mark={UpdatableMark} value={value} onChange={setValue} />
			<pre>{value}</pre>
		</>
	)
}

function ControlledNoEcho({onChange}: {onChange: (value: string) => void}) {
	return <MarkedInput Mark={({value}) => <mark>{value}</mark>} value="Hello @[world](1)" onChange={onChange} />
}

function ControlledRemovableNoEcho({onChange}: {onChange: (value: string) => void}) {
	function RemovableMark() {
		const mark = useMark()
		return <mark onClick={() => mark.remove()}>{mark.value}</mark>
	}

	return <MarkedInput Mark={RemovableMark} value="Hello @[world](1)" onChange={onChange} />
}

function getMarkFocusTarget(element: Element): HTMLElement {
	const target = element.closest<HTMLElement>('[tabindex]')
	if (!target) throw new Error('Expected mark token focus target')
	return target
}

describe(`Component: MarkedInput`, () => {
	it.todo('set readOnly on selection')

	it('renders default text as one editable span', async () => {
		const {container} = await render(<Default defaultValue="plain" />)
		const editor = container.firstElementChild!
		const editable = container.querySelector<HTMLElement>('span[contenteditable]')!

		expect(editor.children).toHaveLength(1)
		expect(editor.firstElementChild).toBe(editable)
		expect(editable).toHaveTextContent('plain')
	})

	it('renders mark roots without adapter wrappers', async () => {
		const {container} = await render(
			<MarkedInput Mark={({value}) => <mark data-testid="mark">{value}</mark>} defaultValue="hello @[world](1)" />
		)
		const editor = container.firstElementChild!
		const mark = container.querySelector<HTMLElement>('mark[data-testid="mark"]')!

		expect(mark.parentElement).toBe(editor)
		expect(mark).toHaveTextContent('world')
		expect(mark.tabIndex).toBe(0)
	})

	it('correctly process an annotation type', async () => {
		const {container} = await render(<Default defaultValue="" />)
		const span = container.querySelector<HTMLElement>('span[contenteditable]')!

		await expect.element(span).toBeInTheDocument()

		await userEvent.type(span, '@[[mark](1)')

		await expect.element(page.getByText('@[mark](1)')).not.toBeInTheDocument()
		await expect.element(page.getByText('mark')).toBeInTheDocument()
	})

	it('support ref focusing target', async () => {
		const {container} = await render(<Focusable />)
		const [firstSpan, secondSpan] = container.querySelectorAll<HTMLElement>('span[contenteditable]')
		const [firstAbbr] = container.querySelectorAll('abbr')
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
		await render(<EchoRemovable />)

		let mark = page.getByText('contain')
		await userEvent.click(mark)
		await expect.element(page.getByText('contain')).not.toBeInTheDocument()

		mark = page.getByText('marks')
		await userEvent.click(mark)
		await expect.element(page.getByText('marks')).not.toBeInTheDocument()
	})

	it('support mark controller updates', async () => {
		await render(<EchoUpdatable />)

		await userEvent.click(page.getByText('world').first())
		await expect.element(page.getByText('world1').first()).toBeInTheDocument()
		await expect.element(page.getByText(/@\[world1]\(Hello! Hello!\)/)).toBeInTheDocument()
	})

	it('keeps controlled span input unchanged until value is echoed', async () => {
		const onChange = vi.fn()
		const {container} = await render(<ControlledNoEcho onChange={onChange} />)
		const [span] = container.querySelectorAll<HTMLElement>('span[contenteditable]')

		await focusAtEnd(span)
		await userEvent.keyboard('!')

		expect(onChange).toHaveBeenCalledWith('Hello !@[world](1)')
		expect(span.textContent).toBe('Hello ')
	})

	it('keeps controlled mark visible after removal until value is echoed', async () => {
		const onChange = vi.fn()
		const {container} = await render(<ControlledRemovableNoEcho onChange={onChange} />)
		const mark = container.querySelector<HTMLElement>('mark')!

		await userEvent.click(mark)

		expect(onChange).toHaveBeenCalledWith('Hello ')
		expect(container.querySelector('mark')?.textContent).toBe('world')
	})

	it('keeps controlled overlay selection text unchanged until value is echoed', async () => {
		const onChange = vi.fn()
		const {container} = await render(
			<MarkedInput
				Mark={({value}) => <mark>{value}</mark>}
				options={[
					{
						// oxlint-disable-next-line no-unsafe-type-assertion
						markup: '@[__value__](__meta__)' as Markup,
						overlay: {trigger: '@', data: ['Alice']},
					},
				]}
				value="Hello @"
				onChange={onChange}
				showOverlayOn="selectionChange"
			/>
		)
		const [span] = container.querySelectorAll<HTMLElement>('span[contenteditable]')

		await focusAtEnd(span)
		await userEvent.keyboard('{ArrowRight}')
		await page.getByText('Alice').click()

		expect(onChange).toHaveBeenCalledWith('Hello @[Alice](0)')
		expect(span.textContent).toBe('Hello @')
	})

	it('support to pass a forward overlay', async () => {
		const Overlay = () => <span>I'm here!</span>

		await render(
			<MarkedInput Mark={() => null} Overlay={Overlay} showOverlayOn="selectionChange" defaultValue="Hello @" />
		)
		const span = page.getByText(/hello/i)
		await focusAtEnd(getElement(span))
		await userEvent.keyboard('{ArrowRight}')
		await expect.element(span).toHaveFocus()

		await expect.element(page.getByText("I'm here!")).toBeInTheDocument()
	})

	it('not create empty mark when pressing Enter in overlay without selection', async () => {
		await render(
			<MarkedInput
				Mark={({value}) => <mark>{value}</mark>}
				options={[
					{
						// oxlint-disable-next-line no-unsafe-type-assertion
						markup: '@[__value__](test:__meta__)' as Markup,
						overlay: {trigger: '@', data: ['one', 'two', 'three']},
					},
				]}
				defaultValue="Hello @"
			/>
		)
		const span = page.getByText(/hello/i)
		await focusAtEnd(getElement(span))
		await userEvent.keyboard('{ArrowRight}')
		await userEvent.keyboard('{Enter}')

		await expect.element(page.getByText('one')).not.toBeInTheDocument()
		await expect.element(page.getByText('two')).not.toBeInTheDocument()
		await expect.element(page.getByText('three')).not.toBeInTheDocument()
	})

	// TODO: user.pointer with offset is not available in vitest/browser.
	// Need to rewrite using native Selection API for text selection testing.
	it.todo('be selectable', async () => {
		//const {container} = await render(<Default defaultValue="Hello @[mark](1)!" />)
		//const selection = window.getSelection()!
		//expect(selection).not.toBeNull()
		// await user.pointer([{target: container, offset: 0, keys: '[MouseLeft>]'}, {offset: 8}])
		// expect(selection.toString(), 'Outer div to cross inner mark').toBe(container.textContent?.slice(0, 8))
		//const MarkedText = container.firstElementChild!
		//const [span1, mark, span2] = MarkedText.children
		// await user.pointer([
		// 	{target: span1, offset: 0, keys: '[MouseLeft>]'},
		// 	{target: mark, offset: 2},
		// ])
		// expect(selection.toString(), 'To mark from the start').toBe(container.textContent?.slice(0, 8))
		// await user.pointer([
		// 	{target: span2, keys: '[MouseLeft>]'},
		// 	{target: mark, offset: 2},
		// ])
		// expect(selection.toString(), 'To mark from the end').toBe(container.textContent?.slice(8))
		// await user.pointer([
		// 	{target: span1, keys: '[MouseLeft>]'},
		// 	{target: mark, offset: 2},
		// ])
		// expect(selection.toString(), 'To mark from before it').toBe(container.textContent?.slice(6, 8))
		// await user.pointer([
		// 	{target: span2, offset: 0, keys: '[MouseLeft>]'},
		// 	{target: mark, offset: 2},
		// ])
		// expect(selection.toString(), 'To mark from after it').toBe(container.textContent?.slice(8, 10))
		// await user.pointer([
		// 	{target: mark, offset: 2, keys: '[MouseLeft>]'},
		// 	{target: span1, offset: 2},
		// ])
		// expect(selection.toString(), 'To span 1 from mark').toBe(container.textContent?.slice(2, 8))
		// await user.pointer([
		// 	{target: mark, offset: 2, keys: '[MouseLeft>]'},
		// 	{target: span2, offset: 1},
		// ])
		// expect(selection.toString(), 'To span 2 from mark').toBe(container.textContent?.slice(8))
		// await user.pointer([{target: span1, offset: 2, keys: '[MouseLeft>]'}, {offset: 4}, {offset: 2}])
		// expect(selection.isCollapsed).toBeTruthy()
		//await userEvent.keyboard('abc')
		//await expect.element(span1, 'Span stay editable after collapse inner selection').toHaveTextContent(/abc/)
	})
})