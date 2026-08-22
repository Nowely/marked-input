import {describe, expect, it} from 'vitest'

import {Parser} from '../parser/Parser'
import type {Markup} from '../parser/types'
import {snapshot, stripIds} from './__testing__/snapshot'
import {adopt} from './adopt'
import {anchorAt, offsetOfAnchor, separatorSpan, stepAnchor} from './anchors'
import {entryAnchor} from './siblings'
import {createTokenTree, sliceNodes} from './tree'

const SEPARATOR = '\n\n'

const rowTree = (markups: Markup[], value: string) => {
	const parser = new Parser(markups)
	return {parser, tree: createTokenTree(parser.parseRows(value, SEPARATOR))}
}

describe('RowNode', () => {
	it('projects rows back to the value byte-for-byte', () => {
		const value = '# a **b**\n\nplain\n\n'
		const {tree} = rowTree(['# __slot__', '**__slot__**'], value)

		expect(tree.value()).toBe(value)
	})

	it('materializes rows back into tokens the parse agrees with', () => {
		const value = '# a\n\ntext **b** tail\n\nlast'
		const {parser, tree} = rowTree(['# __slot__', '**__slot__**'], value)

		expect(stripIds(snapshot(tree.roots()))).toStrictEqual(parser.parseRows(value, SEPARATOR))
	})

	it('slices across rows with the separator as plain text', () => {
		const value = '# a\n\nb'
		const {tree} = rowTree(['# __slot__'], value)

		expect(sliceNodes(tree.roots(), 'start', 'end')).toBe(value)
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
			const answer = separatorSpan(roots, anchorAt(roots, offset), direction)
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

		it('answers nothing in inline layout, whose roots are never rows', () => {
			const parser = new Parser([])
			const tree = createTokenTree(parser.parse('a\n\nb'))
			const roots = tree.roots()
			expect(separatorSpan(roots, anchorAt(roots, 3), -1)).toBeUndefined()
		})
	})

	it('enters a row at its first text child', () => {
		const {tree} = rowTree(['# __slot__'], '# a\n\nplain')
		const roots = tree.roots()

		const anchor = entryAnchor(roots[1])
		expect(anchor).toEqual({node: roots[1].kind === 'row' ? roots[1].children()[0] : undefined, offset: 0})
		expect(offsetOfAnchor(roots, anchor)).toBe(5)
	})
})