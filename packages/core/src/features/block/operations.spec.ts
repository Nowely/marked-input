import {describe, expect, it} from 'vitest'

import type {CoreOption} from '../../shared/types'
import type {NodeAnchor, TreeNode} from '../tokens'
import {nodesOf, textToken} from '../tokens/__testing__/tokenFactories'
import {Parser} from '../tokens/parser/Parser'
import {createRowContent} from './createRowContent'
import type {SliceRead} from './operations'
import {addDragRow, applyDragAction} from './operations'

const rowOptions: CoreOption[] = [{markup: '__slot__\n\n'}]
/** What `createRowContent(rowOptions)` answers — pinned once, below, so the literals stay readable. */
const NEW_ROW = '\n\n'

function offsetOf(doc: string, anchor: NodeAnchor): number {
	if (anchor === 'start') return 0
	if (anchor === 'end') return doc.length
	if ('node' in anchor) return anchor.node.position.start + anchor.offset
	if ('before' in anchor) return anchor.before.position.start
	return anchor.after.position.end
}

/**
 * `read` answers from `doc` by the rows' own positions — the same self-consistent
 * pair the live tree provides (`valueBetween` and `nodes()` always come from one
 * generation), which is what makes every expectation below literal.
 */
function sliceReadOf(doc: string): SliceRead {
	return (from, to) => doc.slice(offsetOf(doc, from), offsetOf(doc, to))
}

/**
 * Rows separated by `gap`. The default tiles the document end to end, as the tree's
 * top-level roots do; a non-empty gap is the shape a live tree never produces, and
 * what pins the gap arithmetic.
 */
function fixture(texts: string[], gap = ''): {rows: readonly TreeNode[]; read: SliceRead; doc: string} {
	let at = 0
	const rows = nodesOf(
		texts.map(text => {
			const token = textToken(text, at)
			at += text.length + gap.length
			return token
		})
	)
	const doc = texts.join(gap)
	return {rows, read: sliceReadOf(doc), doc}
}

/** Real slot-leading mark rows, parsed from `doc` — descriptor identity and `slotRange` included. */
function markFixture(doc: string): {rows: readonly TreeNode[]; read: SliceRead; doc: string} {
	const rows = nodesOf(new Parser(['__slot__\n\n']).parse(doc)).filter(node => node.kind === 'mark')
	return {rows, read: sliceReadOf(doc), doc}
}

describe('applyDragAction (anchor-slice composition)', () => {
	it('delete: removes the row and puts the caret at the promoted row start', () => {
		const {rows, read} = fixture(['alpha\n\n', 'beta\n\n'])
		const result = applyDragAction(read, rows, {type: 'delete', index: 0}, [])
		expect(result).toEqual({value: 'beta\n\n', caret: 0})
	})

	it('delete of a middle row: caret at the start of the row that moved up', () => {
		const {rows, read} = fixture(['alpha\n\n', 'beta\n\n', 'gamma\n\n'])
		const result = applyDragAction(read, rows, {type: 'delete', index: 1}, [])
		expect(result).toEqual({value: 'alpha\n\ngamma\n\n', caret: 7})
	})

	it('delete of the last row: caret at the end of the new last row', () => {
		const {rows, read} = fixture(['alpha\n\n', 'beta\n\n'])
		const result = applyDragAction(read, rows, {type: 'delete', index: 1}, [])
		expect(result).toEqual({value: 'alpha\n\n', caret: 7})
	})

	it('delete of the only row empties the document', () => {
		const {rows, read} = fixture(['alpha\n\n'])
		const result = applyDragAction(read, rows, {type: 'delete', index: 0}, [])
		expect(result).toEqual({value: '', caret: 0})
	})

	it('reorder: moves the row and the gaps travel with the composition', () => {
		const {rows, read} = fixture(['a\n\n', 'b\n\n', 'c\n\n'])
		const result = applyDragAction(read, rows, {type: 'reorder', source: 0, target: 3}, [])
		// 'b\n\n' (3) + 'c\n\n' (3) — the moved row starts at 6.
		expect(result).toEqual({value: 'b\n\nc\n\na\n\n', caret: 6})
	})

	it('reorder to the same place is a no-op (undefined, no write)', () => {
		const {rows, read} = fixture(['a\n\n', 'b\n\n'])
		expect(applyDragAction(read, rows, {type: 'reorder', source: 0, target: 0}, [])).toBeUndefined()
		expect(applyDragAction(read, rows, {type: 'reorder', source: 0, target: 1}, [])).toBeUndefined()
	})

	it('duplicate: copies the row text and puts the caret at the copy start', () => {
		const {rows, read} = fixture(['alpha\n\n', 'beta\n\n'])
		const result = applyDragAction(read, rows, {type: 'duplicate', index: 0}, [])
		expect(result).toEqual({value: 'alpha\n\nalpha\n\nbeta\n\n', caret: 7})
	})

	it('add after a row: inserts the option row content and puts the caret inside it', () => {
		const {rows, read} = fixture(['alpha\n\n'])
		const result = applyDragAction(read, rows, {type: 'add', afterIndex: 0}, rowOptions)
		expect(result).toEqual({value: 'alpha\n\n' + NEW_ROW, caret: 7})
	})

	it('add into an empty document: two empty rows, caret in the first', () => {
		expect(createRowContent(rowOptions)).toBe(NEW_ROW)

		const result = applyDragAction(() => '', [], {type: 'add', afterIndex: 0}, rowOptions)
		expect(result).toEqual({value: NEW_ROW + NEW_ROW, caret: 0})
	})

	it('a row index no row answers to is a no-op (undefined, no write)', () => {
		const {rows, read} = fixture(['a\n\n', 'b\n\n'])
		expect(applyDragAction(read, rows, {type: 'delete', index: 5}, [])).toBeUndefined()
		expect(applyDragAction(read, rows, {type: 'duplicate', index: -1}, [])).toBeUndefined()
	})
})

/**
 * The live tree's roots tile, so every gap is `''` there and the arithmetic below is
 * unreachable in production — which is exactly why it is pinned rather than trusted.
 */
describe('applyDragAction gap arithmetic (non-tiling rows)', () => {
	it('adjacent roots of a real parse leave no gap to compose', () => {
		const {rows, read} = markFixture('a\n\nb\n\nc\n\n')

		expect(read({after: rows[0]}, {before: rows[1]})).toBe('')
		expect(read({after: rows[1]}, {before: rows[2]})).toBe('')
	})

	it('delete drops the row together with ONE gap, and the survivors keep theirs', () => {
		const {rows, read} = fixture(['a', 'b', 'c'], '\n')

		expect(applyDragAction(read, rows, {type: 'delete', index: 1}, [])).toEqual({value: 'a\nc', caret: 2})
	})

	it('duplicate glues the copy to its original', () => {
		const {rows, read} = fixture(['a', 'b', 'c'], '\n')

		// Deliberately NOT the pre-rewrite 'a\na\nb\nc': the gap is the ORIGINAL's
		// separator from the row below and stays there; the copy joins its original.
		expect(applyDragAction(read, rows, {type: 'duplicate', index: 0}, [])).toEqual({value: 'aa\nb\nc', caret: 1})
	})

	it('reorder drops the gap of the moved row and lands it with an empty one', () => {
		const {rows, read} = fixture(['a', 'b', 'c'], '\n')

		expect(applyDragAction(read, rows, {type: 'reorder', source: 0, target: 2}, [])).toEqual({
			value: 'b\nac',
			caret: 2,
		})
	})

	it('add before a row keeps the preceding gap ahead of the new row', () => {
		const {rows, read} = fixture(['a', 'b', 'c'], '\n')

		expect(applyDragAction(read, rows, {type: 'add', afterIndex: 0}, rowOptions)).toEqual({
			value: 'a\n' + NEW_ROW + 'b\nc',
			caret: 2,
		})
	})

	it('add after the last row appends with an empty gap', () => {
		const {rows, read} = fixture(['a', 'b', 'c'], '\n')

		expect(applyDragAction(read, rows, {type: 'add', afterIndex: 2}, rowOptions)).toEqual({
			value: 'a\nb\nc' + NEW_ROW,
			caret: 5,
		})
	})
})

describe('addDragRow (blockEdit call site)', () => {
	it('addDragRow inserts after the row and puts the caret at the END of the inserted content', () => {
		const {rows, read} = fixture(['a\n\n', 'b\n\n'])

		expect(addDragRow(read, rows, 0, NEW_ROW)).toEqual({value: 'a\n\n' + NEW_ROW + 'b\n\n', caret: 5})
	})

	it('addDragRow after the last row appends', () => {
		const {rows, read} = fixture(['a\n\n', 'b\n\n'])

		expect(addDragRow(read, rows, 1, NEW_ROW)).toEqual({value: 'a\n\nb\n\n' + NEW_ROW, caret: 8})
	})
})