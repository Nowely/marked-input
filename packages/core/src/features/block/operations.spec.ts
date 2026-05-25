import {describe, expect, it} from 'vitest'

import type {CoreOption} from '../../shared/types'
import type {Token} from '../parsing'
import {createRowContent} from './createRowContent'
import {addDragRow, applyDragAction, deleteDragRow, duplicateDragRow, reorderDragRows} from './operations'

function textToken(content: string, start: number): Token {
	return {type: 'text', content, position: {start, end: start + content.length}}
}

const options: CoreOption[] = [{}]

describe('applyDragAction', () => {
	it('reorder dispatches to reorderDragRows and returns its value', () => {
		const rows = [textToken('a', 0), textToken('b', 2), textToken('c', 4)]
		const value = 'a\nb\nc'
		const result = applyDragAction(value, rows, {type: 'reorder', source: 0, target: 2}, options)
		expect(result.value).toBe(reorderDragRows(value, [...rows], 0, 2))
	})

	it('reorder returns the original value when source equals target (no-op)', () => {
		const rows = [textToken('a', 0), textToken('b', 2)]
		const value = 'a\nb'
		const result = applyDragAction(value, rows, {type: 'reorder', source: 0, target: 0}, options)
		expect(result.value).toBe(value)
	})

	it('add dispatches to addDragRow with createRowContent', () => {
		const rows = [textToken('a', 0), textToken('b', 2)]
		const value = 'a\nb'
		const expected = addDragRow(value, [...rows], 1, createRowContent(options))
		const result = applyDragAction(value, rows, {type: 'add', afterIndex: 1}, options)
		expect(result.value).toBe(expected)
		expect(result.caret).toBe(rows[1].position.end)
	})

	it('add on empty rows uses the empty-text-token placeholder', () => {
		const result = applyDragAction('', [], {type: 'add', afterIndex: -1}, options)
		const emptyToken: Token = {type: 'text', content: '', position: {start: 0, end: 0}}
		expect(result.value).toBe(addDragRow('', [emptyToken], -1, createRowContent(options)))
	})

	it('delete dispatches to deleteDragRow and computes caret at the next row start', () => {
		const rows = [textToken('a', 0), textToken('b', 2), textToken('c', 4)]
		const value = 'a\nb\nc'
		const expected = deleteDragRow(value, [...rows], 1)
		const result = applyDragAction(value, rows, {type: 'delete', index: 1}, options)
		expect(result.value).toBe(expected)
		expect(result.caret).toBe(Math.min(rows[2].position.start, expected.length))
	})

	it('duplicate dispatches to duplicateDragRow and computes caret at original row end', () => {
		const rows = [textToken('a', 0), textToken('b', 2)]
		const value = 'a\nb'
		const expected = duplicateDragRow(value, [...rows], 0)
		const result = applyDragAction(value, rows, {type: 'duplicate', index: 0}, options)
		expect(result.value).toBe(expected)
		expect(result.caret).toBe(rows[0].position.end)
	})
})