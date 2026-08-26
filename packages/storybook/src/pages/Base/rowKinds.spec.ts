import {describe, expect, it} from 'vitest'

import {defineMark, Mark} from '../../shared/lib/marks'
import {mountComponent} from '../../shared/lib/page'

/**
 * A ROW renders through its KIND's component, in both adapters. Framework-free on purpose: the
 * two `Row` implementations resolve the component through the same core resolver, so a
 * divergence between them is a failing test here rather than a difference nobody diffs.
 *
 * The fixtures are generated marks, which take the row's rendered children exactly as they take a
 * mark's — that shared shape is what lets one file drive both projects.
 */
const Heading = defineMark({tag: 'h1', class: 'heading'})
const Quote = defineMark({tag: 'blockquote'})

const ROWS = {separator: '\n', Mark} as const

describe('row kinds', () => {
	it('paints a typed row through its own component and a paragraph through the paragraph slot', async () => {
		const {host} = await mountComponent({
			value: '# Title\nplain',
			...ROWS,
			options: [{markup: '# __slot__', row: {Component: Heading}}],
		})

		const heading = host.querySelector('h1')
		expect(heading?.textContent).toBe('Title')
		expect(heading?.classList.contains('heading')).toBe(true)
		// The paragraph has no kind, so it keeps the default `slots.paragraph` component. Read by
		// index: the container's last child is the row-controls layer, not a row.
		expect(host.children[1]?.tagName).toBe('DIV')
		expect(host.children[1]?.textContent).toBe('plain')
	})

	it('keeps a row opener out of the painted text', async () => {
		const {host} = await mountComponent({
			value: '# Title',
			...ROWS,
			options: [{markup: '# __slot__', row: {Component: Heading}}],
		})

		// The opener is structural: it stays in the value and never reaches the document.
		expect(host.textContent).toBe('Title')
	})

	it('paints inline marks inside a typed row', async () => {
		const {host} = await mountComponent({
			value: '> quoting @[someone]',
			...ROWS,
			options: [{markup: '> __slot__', row: {Component: Quote}}, {markup: '@[__value__]'}],
		})

		expect(host.querySelector('blockquote mark')?.textContent).toBe('someone')
	})

	it('repaints a row when only its kind changes', async () => {
		const {rerender} = await mountComponent({
			value: 'plain',
			...ROWS,
			options: [{markup: '# __slot__', row: {Component: Heading}}],
		})

		const host = await rerender({
			value: '# plain',
			...ROWS,
			options: [{markup: '# __slot__', row: {Component: Heading}}],
		})

		expect(host.querySelector('h1')?.textContent).toBe('plain')
	})
})