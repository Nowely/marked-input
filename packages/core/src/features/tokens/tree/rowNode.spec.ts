import {describe, expect, it} from 'vitest'

import {Parser} from '../parser/Parser'
import type {Markup} from '../parser/types'
import {snapshot, stripIds} from './__testing__/snapshot'
import {adopt} from './adopt'
import {anchorAt, offsetOfAnchor, stepAnchor} from './anchors'
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

	it('enters a row at its first text child', () => {
		const {tree} = rowTree(['# __slot__'], '# a\n\nplain')
		const roots = tree.roots()

		const anchor = entryAnchor(roots[1])
		expect(anchor).toEqual({node: roots[1].kind === 'row' ? roots[1].children()[0] : undefined, offset: 0})
		expect(offsetOfAnchor(roots, anchor)).toBe(5)
	})
})