import {describe, expect, it} from 'vitest'

import type {CoreOption} from '../../shared/types'
import {nodesOf} from '../tokens/__testing__/tokenFactories'
import {Parser} from '../tokens/parser/Parser'
import type {TreeNode} from '../tokens/tree/types'
import {createRowContent} from './createRowContent'
import {addDragRow, applyDragAction, mergeDragRows} from './operations'

function textRows(...contents: [content: string, start: number][]): readonly TreeNode[] {
	return nodesOf(
		contents.map(([content, start]) => ({
			type: 'text' as const,
			content,
			position: {start, end: start + content.length},
		}))
	)
}

const options: CoreOption[] = [{}]

describe('applyDragAction', () => {
	it('reorder dispatches to reorderDragRows and returns its value', () => {
		const rows = textRows(['a', 0], ['b', 2], ['c', 4])
		const value = 'a\nb\nc'
		const result = applyDragAction(value, rows, {type: 'reorder', source: 0, target: 2}, options)
		// reorderDragRows moves row 0 ('a') to index 2: 'b' + 'a' + 'c', gaps collapsed.
		expect(result.value).toBe('b\nac')
	})

	it('reorder returns the original value when source equals target (no-op)', () => {
		const rows = textRows(['a', 0], ['b', 2])
		const value = 'a\nb'
		const result = applyDragAction(value, rows, {type: 'reorder', source: 0, target: 0}, options)
		expect(result.value).toBe(value)
	})

	it('add dispatches to addDragRow with createRowContent', () => {
		const rows = textRows(['a', 0], ['b', 2])
		const value = 'a\nb'
		const expected = addDragRow(value, rows, 1, createRowContent(options))
		const result = applyDragAction(value, rows, {type: 'add', afterIndex: 1}, options)
		expect(result.value).toBe(expected)
		expect(result.caret).toBe(rows[1].position.end)
	})

	it('add with no rows answers the row content twice and a caret at 0', () => {
		const result = applyDragAction('', [], {type: 'add', afterIndex: -1}, options)
		// Both constants are the deleted EMPTY_TEXT_TOKEN sentinel's answers, kept verbatim:
		// `addDragRow`'s empty-row arm, and that row's own end as the caret.
		const rowContent = createRowContent(options)
		expect(result.value).toBe(rowContent + rowContent)
		expect(result.caret).toBe(0)
	})

	it('delete dispatches to deleteDragRow and computes caret at the next row start', () => {
		const rows = textRows(['a', 0], ['b', 2], ['c', 4])
		const value = 'a\nb\nc'
		const result = applyDragAction(value, rows, {type: 'delete', index: 1}, options)
		// deleteDragRow drops row 1 ('b') by splicing [start of row 1, start of row 2): 'a\nc'.
		const expected = 'a\nc'
		expect(result.value).toBe(expected)
		expect(result.caret).toBe(Math.min(rows[2].position.start, expected.length))
	})

	it('duplicate dispatches to duplicateDragRow and computes caret at original row end', () => {
		const rows = textRows(['a', 0], ['b', 2])
		const value = 'a\nb'
		const result = applyDragAction(value, rows, {type: 'duplicate', index: 0}, options)
		// duplicateDragRow inserts a copy of row 0 ('a') plus its gap before row 1: 'a\na\nb'.
		expect(result.value).toBe('a\na\nb')
		expect(result.caret).toBe(rows[0].position.end)
	})
})

describe('mergeDragRows', () => {
	it('merging into an EMPTY previous row drops its suffix (zero-width slot)', () => {
		// rows: '' and 'b' — the empty row's slot is a zero-width window at its
		// start (Phase 0 parser fix), so the merge removes the empty row's '\n\n'
		// suffix entirely. Old behavior (slot undefined → slotEnd = position.end)
		// was a silent no-op.
		const rowParser = new Parser(['__slot__\n\n'])
		const value = '\n\nb\n\n'
		const rows = nodesOf(rowParser.parse(value)).filter(node => node.kind === 'mark')
		expect(rows).toHaveLength(2)

		const result = mergeDragRows(value, rows, 1)

		expect(result).toEqual({value: 'b\n\n', caret: 0})
	})
})