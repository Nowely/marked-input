import {describe, expect, it} from 'vitest'

import {computed, watch} from '../../../shared/signals'
import {Store} from '../../../store/Store'
import {selectionRange} from '../__testing__/mountFixtures'
import {Parser} from '../parser/Parser'
import type {Markup} from '../parser/types'
import {snapshot, stripIds} from './__testing__/snapshot'
import {adopt} from './adopt'
import {anchorAt, boundarySpan, entryAnchor, offsetOfAnchor, stepAnchor} from './anchors'
import {renderSubscription} from './renderSubscription'
import {createTokenTree, sliceNodes} from './tree'
import type {TreeNode} from './types'

const SEPARATOR = {separator: '\n\n', indent: '\t'}

const rowTree = (markups: Markup[], value: string, rows: boolean[] = []) => {
	const parser = new Parser(markups, rows)
	const tree = createTokenTree(parser.parseRows(value, SEPARATOR))
	tree.config(SEPARATOR)
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

	describe('boundarySpan', () => {
		// 'a\n\nb': row 0 is 'a' + its separator [0,3), row 1 is the unterminated 'b' [3,4].
		const span = (value: string, offset: number, direction: -1 | 1) => {
			const {tree} = rowTree([], value)
			const roots = tree.roots()
			const answer = boundarySpan(roots, anchorAt(roots, offset), direction, SEPARATOR)
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
			expect(boundarySpan(roots, anchorAt(roots, 3), -1, SEPARATOR)).toBeUndefined()
		})

		/**
		 * The boundary between a row and its FIRST CHILD, which the flat reading could not see: a
		 * parent's `position.end` covers its subtree, so a walk over roots finds no boundary there
		 * at all. The span takes the child's LEAD with the separator — a merge that left the indent
		 * behind would put it in the joined row as text.
		 */
		it('spans the separator AND the next row lead, at every depth', () => {
			const parser = new Parser([])
			const config = {separator: '\n', indent: '\t'}
			const tree = createTokenTree(parser.parseRows('a\n\tb\nc', config))
			tree.config(config)
			const roots = tree.roots()

			// 'a\n\tb\nc': 'a' [0,4] with child '\tb' [2,4], then 'c' [4,5].
			expect(boundarySpan(roots, anchorAt(roots, 3), -1, config)).toEqual({
				anchor: anchorAt(roots, 1),
				head: anchorAt(roots, 3),
			})
			const span = boundarySpan(roots, anchorAt(roots, 3), -1, config)
			expect(span && [offsetOfAnchor(roots, span.anchor), offsetOfAnchor(roots, span.head)]).toEqual([1, 3])
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
	 * THE IDENTITY ORACLE for nesting, and it asserts OBJECTS rather than counts on purpose. A
	 * re-indent is an ordinary splice — nothing about the two strings says a row was re-parented —
	 * so without the pre-order `Pairing` adoption's prefix walk stops at the edit and rebuilds the
	 * moved row and everything under it with fresh ids, taking the consumer's per-row state with
	 * them. A count assertion cannot see that; only the object can.
	 */
	describe('setDepth', () => {
		const nestStore = (defaultValue: string) => {
			const store = new Store()
			store.props.set({defaultValue, separator: '\n', Mark: () => null, options: []})
			store.host.container(document.createElement('div'))
			return store
		}

		/** Every node in the document, roots and their text children alike, in document order. */
		const objectsOf = (store: Store): unknown[] => {
			const out: unknown[] = []
			const collect = (node: TreeNode): void => {
				out.push(node)
				if (node.kind !== 'text') node.children().forEach(collect)
			}
			store.tokens.nodes().forEach(collect)
			return out
		}

		it('keeps every node object when a row is indented under the row above it', () => {
			const store = nestStore('a\nb\nc')
			const before = objectsOf(store)
			expect(before.length).toBe(6)

			const row = store.tokens.nodes()[1]
			expect(row.kind === 'row' && row.setDepth(1)).toBe(true)

			expect(store.tokens.value()).toBe('a\n\tb\nc')
			// 'b' is now 'a''s child, so the document has two ROOTS and the same six objects.
			const roots = store.tokens.nodes()
			expect(roots.length).toBe(2)
			expect(roots[0].kind === 'row' && roots[0].rows().length).toBe(1)
			expect(objectsOf(store)).toEqual(before)
		})

		it('keeps every node object when the same row is outdented again', () => {
			const store = nestStore('a\n\tb\nc')
			const before = objectsOf(store)
			const nested = store.tokens.nodes()[0]
			const child = nested.kind === 'row' ? nested.rows()[0] : undefined

			expect(child?.setDepth(0)).toBe(true)

			expect(store.tokens.value()).toBe('a\nb\nc')
			expect(store.tokens.nodes().length).toBe(3)
			expect(objectsOf(store)).toEqual(before)
		})

		it('NORMALIZES a surplus indent run, which is the price of depth having one reading', () => {
			const store = nestStore('a\n\t\t\tb')
			const nested = store.tokens.nodes()[0]
			const child = nested.kind === 'row' ? nested.rows()[0] : undefined

			expect(child?.setDepth(1)).toBe(true)

			expect(store.tokens.value()).toBe('a\n\tb')
		})

		it('refuses a depth deeper than one past the row before it, a no-op and nesting off', () => {
			const store = nestStore('a\nb')
			const rows = store.tokens.nodes()
			expect(rows[0].kind === 'row' && rows[0].setDepth(1)).toBe(false)
			expect(rows[1].kind === 'row' && rows[1].setDepth(2)).toBe(false)
			expect(rows[1].kind === 'row' && rows[1].setDepth(0)).toBe(false)
			expect(rows[1].kind === 'row' && rows[1].setDepth(-1)).toBe(false)
			expect(store.tokens.value()).toBe('a\nb')

			const flat = new Store()
			flat.props.set({defaultValue: 'a\nb', separator: '\n', indent: '', Mark: () => null, options: []})
			flat.host.container(document.createElement('div'))
			const nested = flat.tokens.nodes()[1]
			expect(nested.kind === 'row' && nested.setDepth(1)).toBe(false)
		})

		/**
		 * The ceiling is the SCAN's, and an empty row takes no children — so a row after a blank
		 * line cannot indent under it. Re-deriving the ceiling here as "one past the row before"
		 * answered `true`, wrote the lead, and left the row a root at depth 0 with a stray indent
		 * only `setDepth(0)` could clear.
		 */
		it('refuses to indent under an EMPTY row, which takes no children', () => {
			const store = nestStore('a\n\nb')
			const row = store.tokens.nodes()[2]

			expect(row.kind === 'row' && row.setDepth(1)).toBe(false)
			expect(store.tokens.value()).toBe('a\n\nb')
			expect(store.tokens.nodes().length).toBe(3)
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