import type {Markup} from '@markput/core'
import {beforeEach, describe, expect, it} from 'vitest'
import {page, userEvent} from 'vitest/browser'

import {findEditingHost, getElement} from '../../shared/lib/dom'
import {composePage, mount, mountComponent} from '../../shared/lib/page'
import {capture, marks} from './Nested.fixtures'
import * as NestedStories from './Nested.stories'

/**
 * The page's marks are configured per test rather than through a story: every case here builds
 * its own markup/value pair, which is why this spec mounts the component directly.
 */
const SLOT_MARKUP: Markup = '@[__slot__]'
const TAG_MARKUP: Markup = '#[__slot__]'
const VALUE_MARKUP: Markup = '@[__value__]'
const VALUE_META_MARKUP: Markup = '@[__value__](__meta__)'

beforeEach(() => {
	capture.rootChildren = false
	capture.rootHasNestedMarks = false
})

describe('Nested Marks Rendering', () => {
	it('render simple nested marks', async () => {
		await mountComponent({Mark: marks.Info, value: '@[outer @[inner]]', options: [{markup: SLOT_MARKUP}]})

		const outerMark = page.getByTestId('mark-depth-0')
		const innerMark = page.getByTestId('mark-depth-1')

		await expect.element(outerMark).toBeInTheDocument()
		await expect.element(innerMark).toBeInTheDocument()
		expect(outerMark.element().getAttribute('data-has-children')).toBe('true')
		expect(innerMark.element().getAttribute('data-has-children')).toBe('false')
	})

	it('render multiple nesting levels', async () => {
		await mountComponent({
			Mark: marks.Info,
			value: '@[level0 @[level1 @[level2]]]',
			options: [{markup: SLOT_MARKUP}],
		})

		await expect.element(page.getByTestId('mark-depth-0')).toBeInTheDocument()
		await expect.element(page.getByTestId('mark-depth-1')).toBeInTheDocument()
		await expect.element(page.getByTestId('mark-depth-2')).toBeInTheDocument()
	})

	it('render multiple nested marks at same level', async () => {
		await mountComponent({
			Mark: marks.Info,
			value: '@[outer @[first] and @[second]]',
			options: [{markup: SLOT_MARKUP}],
		})

		const outerMark = page.getByTestId('mark-depth-0')
		const nestedMarks = page.getByTestId('mark-depth-1').all()

		await expect.element(outerMark).toBeInTheDocument()
		expect(nestedMarks).toHaveLength(2)
	})

	it('render different markup types nested', async () => {
		await mountComponent({
			Mark: marks.Tagged,
			value: '#[tag with @[mention]]',
			options: [
				{markup: TAG_MARKUP, overlay: {trigger: '#'}},
				{markup: SLOT_MARKUP, overlay: {trigger: '@'}},
			],
		})

		const tagMark = page.getByTestId('tag-mark')
		const mentionMark = page.getByTestId('mention-mark')

		await expect.element(tagMark).toBeInTheDocument()
		await expect.element(mentionMark).toBeInTheDocument()
		expect(tagMark.element().getAttribute('data-depth')).toBe('0')
		expect(mentionMark.element().getAttribute('data-depth')).toBe('1')
	})

	it('handle empty nested marks', async () => {
		await mountComponent({Mark: marks.Info, value: '@[@[]]', options: [{markup: SLOT_MARKUP}]})

		const found = page.getByTestId(/mark-depth-/).all()
		expect(found).toHaveLength(2)
	})

	it('pass children to Mark component for nested content', async () => {
		const {host} = await mountComponent({
			Mark: marks.Capturing,
			value: '@[before @[nested] after]',
			options: [{markup: SLOT_MARKUP}],
		})

		expect(host.textContent).toContain('before')
		expect(host.textContent).toContain('after')
		expect(host.textContent).toContain('nested')
		// The root mark has nested marks, so it is the one that must have received children.
		expect(capture.rootChildren).toBe(true)
	})

	it('renders nested token roots without slot-root wrappers', async () => {
		const {host} = await mountComponent({
			Mark: marks.MarkRoot,
			defaultValue: '@[before @[nested] after]',
			options: [{markup: SLOT_MARKUP}],
		})
		const outer = host.querySelector('mark')!
		const inner = host.querySelectorAll('mark')[1]
		const childSequenceHost = outer.firstElementChild
		if (!(childSequenceHost instanceof HTMLElement)) throw new Error('Expected child sequence host')

		// ONE child sequence host under the mark root, and the nested root sits directly in it:
		// no per-token wrapper on the way down.
		expect(Array.from(outer.children)).toEqual([childSequenceHost])
		expect(childSequenceHost.tagName).toBe('SPAN')
		expect(childSequenceHost.style.display).toBe('contents')
		expect(childSequenceHost.parentElement).toBe(outer)
		expect(inner.parentElement).toBe(childSequenceHost)
		expect(Array.from(childSequenceHost.children)).toContain(inner)
		expect(childSequenceHost.querySelector('span > span > mark')).toBeNull()
	})
})

describe('Nested Marks Tree Navigation', () => {
	it('provide correct depth information', async () => {
		const {host} = await mountComponent({
			Mark: marks.Depth,
			value: '@[d0 @[d1 @[d2]]]',
			options: [{markup: SLOT_MARKUP}],
		})

		const depths = Array.from(host.querySelectorAll('[data-depth]')).map(el => el.getAttribute('data-depth'))

		expect(depths).toEqual(['0', '1', '2'])
	})

	it('provide hasChildren information', async () => {
		const {host} = await mountComponent({
			Mark: marks.HasChildren,
			value: '@[parent @[child]]',
			options: [{markup: SLOT_MARKUP}],
		})

		const elements = Array.from(host.querySelectorAll('[data-has-children]'))
		const hasChildrenValues = elements.map(el => el.getAttribute('data-has-children'))

		expect(hasChildrenValues).toEqual(['true', 'false'])
	})

	it('provide nested mark information', async () => {
		await mountComponent({
			Mark: marks.RootInfo,
			value: '@[parent @[child1] text @[child2]]',
			options: [{markup: SLOT_MARKUP}],
		})

		expect(capture.rootHasNestedMarks).toBe(true)
	})
})

describe('Backward Compatibility', () => {
	it('work with flat marks (no nesting)', async () => {
		await mountComponent({Mark: marks.Flat, value: '@[test](meta)', options: [{markup: VALUE_META_MARKUP}]})

		const mark = page.getByTestId('flat-mark')
		await expect.element(mark).toBeInTheDocument()
		expect(mark.element().textContent).toBe('test')
	})

	it('ignore children prop in flat marks', async () => {
		await mountComponent({Mark: marks.Flat, value: '@[test]', options: [{markup: VALUE_MARKUP}]})

		const mark = page.getByTestId('flat-mark')
		await expect.element(mark).toBeInTheDocument()
		expect(mark.element().textContent).toBe('test')
	})

	it('not parse nested content in __value__ placeholders', async () => {
		await mountComponent({Mark: marks.Flat, value: '@[text with @[nested]]', options: [{markup: VALUE_MARKUP}]})

		// Only one mark: `__value__` does not support nesting, so the inner `@[nested]` stays
		// plain text inside the value.
		const found = page.getByTestId('flat-mark').all()
		expect(found).toHaveLength(1)
		expect(found[0].element().textContent).toContain('text with @[nested]')
	})
})

describe('Complex Nesting Scenarios', () => {
	it('handle adjacent nested marks', async () => {
		await mountComponent({Mark: marks.Plain, value: '@[first]@[second]', options: [{markup: SLOT_MARKUP}]})

		const found = page.getByRole('mark').all()
		expect(found).toHaveLength(2)
	})

	it('handle deeply nested structure', async () => {
		const {host} = await mountComponent({
			Mark: marks.Depth,
			value: '@[@[@[@[@[deep]]]]]',
			options: [{markup: SLOT_MARKUP}],
		})

		const depths = Array.from(host.querySelectorAll('[data-depth]')).map(el =>
			parseInt(el.getAttribute('data-depth') ?? '0')
		)

		// Five levels: 0, 1, 2, 3, 4.
		expect(Math.max(...depths)).toBe(4)
	})

	it('handle mixed nested and flat marks', async () => {
		await mountComponent({
			Mark: marks.Mixed,
			value: '@[nested @[child]] @[another]',
			options: [{markup: SLOT_MARKUP}],
		})

		// Exactly three: the outer mark, the one nested in it, and the flat one beside it.
		const found = page.getByRole('mark').all()
		expect(found).toHaveLength(3)
	})

	it('render nested structure when Mark component renders children', async () => {
		const {host} = await mountComponent({
			Mark: marks.Rendering,
			value: '@[Hello @[World] from @[Nested] marks]',
			options: [{markup: SLOT_MARKUP}],
		})

		expect(host.textContent).toContain('Hello')
		expect(host.textContent).toContain('World')
		expect(host.textContent).toContain('from')
		expect(host.textContent).toContain('Nested')
		expect(host.textContent).toContain('marks')
	})
})

describe('Edge Cases', () => {
	it('handle empty input', async () => {
		const {host} = await mountComponent({Mark: marks.Bare, value: '', options: [{markup: SLOT_MARKUP}]})

		expect(host.textContent).toBe('')
	})

	it('handle input with no marks', async () => {
		const {host} = await mountComponent({
			Mark: marks.Bare,
			value: 'Just plain text',
			options: [{markup: SLOT_MARKUP}],
		})

		expect(host.textContent).toBe('Just plain text')
	})

	it('handle malformed nested marks gracefully', async () => {
		const {host} = await mountComponent({
			Mark: marks.Plain,
			value: '@[unclosed @[nested',
			options: [{markup: SLOT_MARKUP}],
		})

		// Neither markup closes, so nothing is a mark: the whole value stays literal text.
		expect(host.textContent).toBe('@[unclosed @[nested')
		expect(host.querySelector('mark')).toBeNull()
	})
})

describe('Tabbed documents', () => {
	const {ComplexMarkdown, ComplexHtmlDocument} = composePage(NestedStories)

	// The Preview tab is read-only and the Write tab drops the prop rather than setting it
	// false. That is the shape that used to leave the editor read-only for good, because an
	// absent prop never reached its setter.
	it.each([
		['ComplexMarkdown', ComplexMarkdown],
		['ComplexHtmlDocument', ComplexHtmlDocument],
	])('%s switches to an editable Write tab', async (_name, Story) => {
		await mount(Story)
		expect(findEditingHost(document.body)).toHaveAttribute('contenteditable', 'false')

		await userEvent.click(getElement(page.getByText('Write')))

		expect(findEditingHost(document.body)).toHaveAttribute('contenteditable', 'true')
	})
})