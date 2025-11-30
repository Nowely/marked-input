import '@testing-library/jest-dom'
import {render} from '@testing-library/react'
import user from '@testing-library/user-event'
import {Focusable, Removable} from '../Dynamic/Dynamic.stories'
import {describe, expect, it} from 'vitest'
import {composeStories} from '@storybook/react-vite'
import * as BaseStories from './Base.stories'
import {focusAtStart} from '../../shared/lib/focus'

const {Default} = composeStories(BaseStories)

describe(`Component: MarkedInput`, () => {
	it.todo('should set readOnly on selection')

	//TODO mark focus

	it('should correct process an annotation type', async () => {
		const {container, queryByText} = render(<Default defaultValue="" />)
		const [span] = container.querySelectorAll('span')

		expect(span).toHaveTextContent('')

		await user.type(span, '@[[mark](1)')

		expect(queryByText('@[mark](1)')).toBeNull()
		expect(queryByText('mark')).toBeInTheDocument()
	})

	it.todo('should support ref focusing target', async () => {
		const {container} = render(<Focusable />)
		const [firstSpan, secondSpan] = container.querySelectorAll('span')
		const [firstAbbr] = container.querySelectorAll('abbr')
		const firstSpanLength = firstSpan.textContent?.length ?? 0
		const firstAbbrLength = firstAbbr.textContent?.length ?? 0

		await focusAtStart(firstSpan)

		await user.keyboard(`{ArrowRight>${firstSpanLength + 1}/}`)
		expect(firstAbbr).toHaveFocus()

		await user.keyboard(`{ArrowLeft>1/}`)
		expect(firstSpan).toHaveFocus()

		await user.keyboard(`{ArrowRight>1/}`)
		expect(firstAbbr).toHaveFocus()

		await user.keyboard(`{ArrowRight>${firstAbbrLength + 1}/}`)
		expect(secondSpan).toHaveFocus()

		await user.keyboard(`{ArrowLeft>1/}`)
		expect(firstAbbr).toHaveFocus()
	})

	it('should support remove itself', async () => {
		const {getByText, queryByText} = render(<Removable />)

		let mark = getByText('contain')
		await user.click(mark)
		expect(queryByText('contain')).toBeNull()

		mark = getByText('marks')
		await user.click(mark)
		expect(queryByText('marks')).toBeNull()
	})

	it('should support editable marks', async () => {
		const {getByText} = render(<Focusable />)

		await user.type(getByText('world'), '123')

		expect(getByText('world123')).toBeInTheDocument()
		expect(getByText(/@\[world123]\(Hello! Hello!\)/)).toBeInTheDocument()
	})

	it.todo('should be selectable', async () => {
		const {container} = render(<Default defaultValue="Hello @[mark](1)!" />)
		const selection = window.getSelection()!
		expect(selection).not.toBeNull()

		await user.pointer([{target: container, offset: 0, keys: '[MouseLeft>]'}, {offset: 8}])
		expect(selection.toString(), 'Outer div to cross inner mark').toBe(container.textContent?.slice(0, 8))

		const MarkedText = container.firstElementChild!
		const [span1, mark, span2] = MarkedText.children

		await user.pointer([
			{target: span1, offset: 0, keys: '[MouseLeft>]'},
			{target: mark, offset: 2},
		])
		expect(selection.toString(), 'To mark from the start').toBe(container.textContent?.slice(0, 8))

		await user.pointer([
			{target: span2, keys: '[MouseLeft>]'},
			{target: mark, offset: 2},
		])
		expect(selection.toString(), 'To mark from the end').toBe(container.textContent?.slice(8))

		await user.pointer([
			{target: span1, keys: '[MouseLeft>]'},
			{target: mark, offset: 2},
		])
		expect(selection.toString(), 'To mark from before it').toBe(container.textContent?.slice(6, 8))

		await user.pointer([
			{target: span2, offset: 0, keys: '[MouseLeft>]'},
			{target: mark, offset: 2},
		])
		expect(selection.toString(), 'To mark from after it').toBe(container.textContent?.slice(8, 10))

		await user.pointer([
			{target: mark, offset: 2, keys: '[MouseLeft>]'},
			{target: span1, offset: 2},
		])
		expect(selection.toString(), 'To span 1 from mark').toBe(container.textContent?.slice(2, 8))

		await user.pointer([
			{target: mark, offset: 2, keys: '[MouseLeft>]'},
			{target: span2, offset: 1},
		])
		expect(selection.toString(), 'To span 2 from mark').toBe(container.textContent?.slice(8))

		await user.pointer([{target: span1, offset: 2, keys: '[MouseLeft>]'}, {offset: 4}, {offset: 2}])
		expect(selection.isCollapsed).toBeTruthy()
		await user.keyboard('abc')
		expect(span1, 'Span stay editable after collapse inner selection').toHaveTextContent(/abc/)
	})
})

