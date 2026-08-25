import {describe, expect, it} from 'vitest'

import {computed, watch} from '../../../shared/signals'
import {Store} from '../../../store/Store'
import {selectionRange} from '../__testing__/mountFixtures'
import {Parser} from '../parser/Parser'
import type {Markup} from '../parser/types'
import {snapshot, stripIds} from './__testing__/snapshot'
import {adopt} from './adopt'
import {anchorAt, entryAnchor, offsetOfAnchor, separatorSpan, stepAnchor} from './anchors'
import {renderSubscription} from './renderSubscription'
import {createTokenTree, sliceNodes} from './tree'

const SEPARATOR = {separator: '\n\n', indent: '\t'}

const rowTree = (markups: Markup[], value: string, rows: boolean[] = []) => {
	const parser = new Parser(markups, rows)
	const tree = createTokenTree(parser.parseRows(value, SEPARATOR))
	tree.separator(SEPARATOR.separator)
	return {parser, tree}
}

describe('RowNode', () => {
	it('projects rows back to the value byte-for-byte', () => {
		const value = '# a **b**\n\nplain\n\n'
		const {tree} = rowTree(['# __slot__', '**__slot__**'], value, [true, false])

		expect(tree.value()).toBe(value)
	})

	it('materializes rows back into tokens the parse agrees with', () => {
		const value = '# a\n\ntext **b** tail\n\nlast'
		const {parser, tree} = rowTree(['# __slot__', '**__slot__**'], value, [true, false])

		expect(stripIds(snapshot(tree.roots(), SEPARATOR.separator))).toStrictEqual(parser.parseRows(value, SEPARATOR))
	})

	it('slices across rows with the separator as plain text', () => {
		const value = '# a\n\nb'
		const {tree} = rowTree(['# __slot__'], value, [true])

		expect(sliceNodes(tree.roots(), 'start', 'end', SEPARATOR.separator)).toBe(value)
	})

	it('retains every row object across an in-row edit', () => {
		const {parser, tree} = rowTree([], 'a\n\nb\n\n')
		const before = tree.roots()

		adopt(tree, {start: 1, end: 1, insertedLength: 1}, parser.parseRows('ax\n\nb\n\n', SEPARATOR))

		const after = tree.roots()
		expect(after.length).toBe(3)
		expect(after[0]).toBe(before[0])
		expect(after[1]).toBe(before[1])
		expect(after[2]).toBe(before[2])
		expect(tree.value()).toBe('ax\n\nb\n\n')
		expect(after[1].position).toEqual({start: 4, end: 7})
	})

	it('keeps the anchor row when a separator insertion adds a row', () => {
		const {parser, tree} = rowTree([], 'a\n\nb')
		const before = tree.roots()

		// Enter at the document end: insert the separator after 'b'
		adopt(tree, {start: 4, end: 4, insertedLength: 2}, parser.parseRows('a\n\nb\n\n', SEPARATOR))

		const after = tree.roots()
		expect(after.length).toBe(3)
		expect(after[0]).toBe(before[0])
		expect(after[1]).toBe(before[1])
		expect(tree.value()).toBe('a\n\nb\n\n')
	})

	it('answers the row boundary for an offset inside its separator', () => {
		const {tree} = rowTree([], 'a\n\nb')
		const roots = tree.roots()

		const anchor = anchorAt(roots, 2)
		expect(anchor).toEqual({after: roots[0]})
	})

	it('fails closed when a step lands inside a separator', () => {
		const {tree} = rowTree([], 'a\n\nb')
		const roots = tree.roots()

		// One step right from the end of row 0's content lands inside '\n\n'
		const from = anchorAt(roots, 1)
		expect(stepAnchor(roots, from, 1)).toBeUndefined()
	})

	describe('separatorSpan', () => {
		// 'a\n\nb': row 0 is 'a' + its separator [0,3), row 1 is the unterminated 'b' [3,4].
		const span = (value: string, offset: number, direction: -1 | 1) => {
			const {tree} = rowTree([], value)
			const roots = tree.roots()
			const answer = separatorSpan(roots, anchorAt(roots, offset), direction, SEPARATOR.separator)
			return answer && [offsetOfAnchor(roots, answer.anchor), offsetOfAnchor(roots, answer.head)]
		}

		it('expands a backward delete at a row START onto the whole separator', () => {
			expect(span('a\n\nb', 3, -1)).toEqual([1, 3])
		})

		it('expands a forward delete at a row CONTENT END onto its own separator', () => {
			expect(span('a\n\nb', 1, 1)).toEqual([1, 3])
		})

		it('takes the separator BEHIND a forward delete at a row start', () => {
			// Not a symmetry — block layout's own answer for Delete pressed at a row start,
			// which merges that row into the previous one.
			expect(span('a\n\nb', 3, 1)).toEqual([1, 3])
		})

		it('leaves a backward delete at a row content end to the character step', () => {
			expect(span('a\n\nb', 1, -1)).toBeUndefined()
		})

		it('answers nothing at the document end, where the final row owns no separator', () => {
			expect(span('a\n\nb', 4, 1)).toBeUndefined()
			expect(span('a\n\nb', 4, -1)).toBeUndefined()
		})

		it('prefers the EARLIER separator where an empty row makes both arms match', () => {
			// 'a\n\n\n\nb': offset 3 is row 1's content end AND row 0's own end. Removing row 0's
			// separator is what a delete there has always done.
			expect(span('a\n\n\n\nb', 3, 1)).toEqual([1, 3])
		})

		it('answers nothing where the roots are not rows', () => {
			const parser = new Parser([])
			const tree = createTokenTree(parser.parse('a\n\nb'))
			const roots = tree.roots()
			expect(separatorSpan(roots, anchorAt(roots, 3), -1, SEPARATOR.separator)).toBeUndefined()
		})
	})

	it('enters a row at its first text child', () => {
		const {tree} = rowTree(['# __slot__'], '# a\n\nplain', [true])
		const roots = tree.roots()

		const anchor = entryAnchor(roots[1])
		expect(anchor).toEqual({node: roots[1].kind === 'row' ? roots[1].children()[0] : undefined, offset: 0})
		expect(offsetOfAnchor(roots, anchor)).toBe(5)
	})

	/**
	 * A TYPED row's opener is structural, so no text child covers the row's own start — the one
	 * shape that breaks `anchorAt`'s "every owner's start is covered by a text node" reading.
	 * Without the row arm offset 0 falls through to `{after: row}`, which is the END of the
	 * heading, and `selection.selectAll` inherits the mistake through its `anchorAt(0)` seed.
	 */
	describe('an offset inside a row opener', () => {
		it('answers the row body start, not the row end', () => {
			const {tree} = rowTree(['# __slot__'], '# Title', [true])
			const roots = tree.roots()
			const body = roots[0].kind === 'row' ? roots[0].children()[0] : undefined

			expect(anchorAt(roots, 0)).toEqual({node: body, offset: 0})
			expect(anchorAt(roots, 1)).toEqual({node: body, offset: 0})
			expect(offsetOfAnchor(roots, anchorAt(roots, 0))).toBe(2)
		})

		it('carries select-all from the top of the document', () => {
			const store = new Store()
			store.props.set({
				defaultValue: '# Title\n\nBody',
				separator: '\n\n',
				Mark: () => null,
				options: [{markup: '# __slot__', row: {Component: 'h1'}}],
			})
			store.host.container(document.createElement('div'))

			store.tokens.selection.selectAll()

			expect(selectionRange(store)).toEqual({start: 2, end: 13})
			expect(store.tokens.selection.isAllSelected()).toBe(true)
		})
	})

	/**
	 * The row's REPAINT contract, in three parts. A subscription over `children()` alone answers
	 * none of them, because adoption re-uses the same child objects and writes their signals in
	 * place.
	 */
	describe('the row repaint subscription', () => {
		const rowStore = (defaultValue: string, markup: Markup, Component: string) => {
			const store = new Store()
			store.props.set({
				defaultValue,
				separator: '\n',
				Mark: () => null,
				options: [{markup, row: {Component}}],
			})
			store.host.container(document.createElement('div'))

			const row = store.tokens.nodes()[0]
			const repaint = computed(renderSubscription(row))
			let repaints = 0
			const stop = watch(repaint, () => repaints++)
			return {store, row, stop, repaints: () => repaints}
		}

		/**
		 * A retype that leaves the body untouched — a todo's checkbox, a callout's tone, a fence's
		 * language — changes only the row's kind and meta, so without those two the row keeps
		 * painting its old markup while the value already carries the new one.
		 */
		it('notifies when only the kind and meta change', () => {
			const {store, row, stop, repaints} = rowStore('- [ ] task', '- [__meta__] __slot__', 'li')

			// The one keystroke a row control makes: the body text is byte-identical either side.
			store.tokens.setValue('- [x] task')

			expect(store.tokens.value()).toBe('- [x] task')
			expect(store.tokens.nodes()[0]).toBe(row)
			expect(repaints()).toBe(1)
			stop()
		})

		/**
		 * A RAW body is never re-parsed, so its one text child is rewritten in place and is never
		 * painted by a Span of its own — the kind's component paints it off `node.slot()`. Without
		 * the row's own `slot` read, a table's text changes and the table on screen does not.
		 */
		it('notifies when a RAW body changes', () => {
			const {store, row, stop, repaints} = rowStore('|a', '|__value__', 'div')

			store.tokens.setValue('|b')

			expect(store.tokens.value()).toBe('|b')
			expect(store.tokens.nodes()[0]).toBe(row)
			expect(row.kind === 'row' && row.slot()).toBe('b')
			expect(repaints()).toBe(1)
			stop()
		})

		/** The gate on that read: a `__slot__` body is painted by its children's own Spans. */
		it('stays silent on a keystroke inside a SLOT body', () => {
			const {store, stop, repaints} = rowStore('# a', '# __slot__', 'h1')

			store.tokens.setValue('# ab')

			expect(repaints()).toBe(0)
			stop()
		})
	})
})