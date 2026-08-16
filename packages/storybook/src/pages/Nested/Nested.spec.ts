import type {Markup} from '@markput/core'
import {describe, expect, it} from 'vitest'
import {page, userEvent} from 'vitest/browser'

import {findEditingHost, getElement} from '../../shared/lib/dom'
import {defineMark, Mark, Span} from '../../shared/lib/marks'
import {composePage, mount, mountComponent} from '../../shared/lib/page'
import {marks} from './Nested.fixtures'
import * as NestedStories from './Nested.stories'

/**
 * The page's marks are configured per test rather than through a story: every case here builds
 * its own markup/value pair, which is why this spec mounts the component directly.
 */
const SLOT_MARKUP: Markup = '@[__slot__]'
const TAG_MARKUP: Markup = '#[__slot__]'
const VALUE_MARKUP: Markup = '@[__value__]'
const VALUE_META_MARKUP: Markup = '@[__value__](__meta__)'

/** Every `Info` mark's depth, in document order — the identity the spec used to read off a testid. */
const depthsOf = (host: Element) =>
	Array.from(host.querySelectorAll('[data-depth]')).map(el => el.getAttribute('data-depth'))

const markAtDepth = (host: Element, depth: number) => {
	const mark = host.querySelector(`[data-depth="${depth}"]`)
	if (!mark) throw new Error(`No mark at depth ${depth}`)
	return mark
}

describe('Nested Marks Rendering', () => {
	it('render simple nested marks', async () => {
		const {host} = await mountComponent({
			Mark: marks.Info,
			value: '@[outer @[inner]]',
			options: [{markup: SLOT_MARKUP}],
		})

		expect(depthsOf(host)).toEqual(['0', '1'])
		expect(markAtDepth(host, 0).getAttribute('data-has-children')).toBe('true')
		expect(markAtDepth(host, 1).getAttribute('data-has-children')).toBe('false')
	})

	it('render multiple nesting levels', async () => {
		const {host} = await mountComponent({
			Mark: marks.Info,
			value: '@[level0 @[level1 @[level2]]]',
			options: [{markup: SLOT_MARKUP}],
		})

		expect(depthsOf(host)).toEqual(['0', '1', '2'])
	})

	it('render multiple nested marks at same level', async () => {
		const {host} = await mountComponent({
			Mark: marks.Info,
			value: '@[outer @[first] and @[second]]',
			options: [{markup: SLOT_MARKUP}],
		})

		expect(depthsOf(host)).toEqual(['0', '1', '1'])
	})

	it('routes each nested markup to the Mark of its own option', async () => {
		const {host} = await mountComponent({
			value: '#[tag with @[mention]]',
			options: [
				{markup: TAG_MARKUP, Mark: defineMark({tag: 'b'}), overlay: {trigger: '#'}},
				{markup: SLOT_MARKUP, Mark: defineMark({tag: 'i'}), overlay: {trigger: '@'}},
			],
		})

		const tag = host.querySelector('b')
		const mention = host.querySelector('i')

		// A per-option `Mark` is THE mechanism that tells markups apart, so giving the two options
		// different elements is what makes the routing observable. Containment pins the direction:
		// were the options swapped, the `@[...]` element would be the outer one.
		expect(tag).not.toBeNull()
		expect(mention).not.toBeNull()
		expect(tag?.contains(mention)).toBe(true)
	})

	it('handle empty nested marks', async () => {
		const {host} = await mountComponent({Mark: marks.Info, value: '@[@[]]', options: [{markup: SLOT_MARKUP}]})

		expect(depthsOf(host)).toHaveLength(2)
	})

	it('renders the text on both sides of a nested mark', async () => {
		const {host} = await mountComponent({
			Mark: marks.Info,
			value: '@[before @[nested] after]',
			options: [{markup: SLOT_MARKUP}],
		})

		expect(host.textContent).toContain('before')
		expect(host.textContent).toContain('after')
		expect(host.textContent).toContain('nested')
	})

	it('renders nested token roots without slot-root wrappers', async () => {
		const {host} = await mountComponent({
			Mark,
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
			Mark: marks.Info,
			value: '@[d0 @[d1 @[d2]]]',
			options: [{markup: SLOT_MARKUP}],
		})

		const depths = Array.from(host.querySelectorAll('[data-depth]')).map(el => el.getAttribute('data-depth'))

		expect(depths).toEqual(['0', '1', '2'])
	})

	it('provide hasChildren information', async () => {
		const {host} = await mountComponent({
			Mark: marks.Info,
			value: '@[parent @[child]]',
			options: [{markup: SLOT_MARKUP}],
		})

		const elements = Array.from(host.querySelectorAll('[data-has-children]'))
		const hasChildrenValues = elements.map(el => el.getAttribute('data-has-children'))

		expect(hasChildrenValues).toEqual(['true', 'false'])
	})

	it('provide hasChildren information with more than one nested mark', async () => {
		const {host} = await mountComponent({
			Mark: marks.Info,
			value: '@[parent @[child1] text @[child2]]',
			options: [{markup: SLOT_MARKUP}],
		})

		const elements = Array.from(host.querySelectorAll('[data-has-children]'))

		expect(elements.map(el => el.getAttribute('data-has-children'))).toEqual(['true', 'false', 'false'])
	})
})

describe('Backward Compatibility', () => {
	it('work with flat marks (no nesting)', async () => {
		await mountComponent({Mark, value: '@[test](meta)', options: [{markup: VALUE_META_MARKUP}]})

		const mark = page.getByRole('mark')
		await expect.element(mark).toBeInTheDocument()
		expect(mark.element().textContent).toBe('test')
	})

	it('ignore children prop in flat marks', async () => {
		await mountComponent({Mark, value: '@[test]', options: [{markup: VALUE_MARKUP}]})

		const mark = page.getByRole('mark')
		await expect.element(mark).toBeInTheDocument()
		expect(mark.element().textContent).toBe('test')
	})

	it('not parse nested content in __value__ placeholders', async () => {
		await mountComponent({Mark, value: '@[text with @[nested]]', options: [{markup: VALUE_MARKUP}]})

		// Only one mark: `__value__` does not support nesting, so the inner `@[nested]` stays
		// plain text inside the value.
		const found = page.getByRole('mark').all()
		expect(found).toHaveLength(1)
		expect(found[0].element().textContent).toContain('text with @[nested]')
	})
})

describe('Complex Nesting Scenarios', () => {
	it('handle adjacent nested marks', async () => {
		await mountComponent({Mark, value: '@[first]@[second]', options: [{markup: SLOT_MARKUP}]})

		const found = page.getByRole('mark').all()
		expect(found).toHaveLength(2)
	})

	it('handle deeply nested structure', async () => {
		const {host} = await mountComponent({
			Mark: marks.Info,
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
			Mark,
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
		const {host} = await mountComponent({Mark: Span, value: '', options: [{markup: SLOT_MARKUP}]})

		expect(host.textContent).toBe('')
	})

	it('handle input with no marks', async () => {
		const {host} = await mountComponent({
			Mark: Span,
			value: 'Just plain text',
			options: [{markup: SLOT_MARKUP}],
		})

		expect(host.textContent).toBe('Just plain text')
	})

	it('handle malformed nested marks gracefully', async () => {
		const {host} = await mountComponent({
			Mark,
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