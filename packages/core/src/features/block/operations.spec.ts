import {describe, expect, it} from 'vitest'

import type {NodeAnchor, TreeNode} from '../tokens'
import {nodesOf, textToken} from '../tokens/__testing__/tokenFactories'
import type {SliceRead} from './operations'
import {addDragRow} from './operations'

/** What `createRowContent` answers for a `'__slot__\n\n'` row markup — pinned so the literals stay readable. */
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