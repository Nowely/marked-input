import type {Token} from '../parsing'
import {BLOCK_SEPARATOR} from './config'

function isTextRow(row: Token): boolean {
	return row.type === 'text'
}

function gapBetween(a: Token, b: Token): number {
	return b.position.start - a.position.end
}

/**
 * Returns the separator that should sit between two adjacent rows in the value.
 * Text-text pairs need `\n\n`; everything else is adjacent with no separator.
 */
function separatorBetween(a: Token, b: Token): string {
	return isTextRow(a) && isTextRow(b) ? BLOCK_SEPARATOR : ''
}

/**
 * Returns whether two adjacent rows can be merged (Backspace/Delete).
 * Only text-text pairs separated by exactly `\n\n` are mergeable.
 */
export function canMergeRows(a: Token, b: Token): boolean {
	return isTextRow(a) && isTextRow(b) && gapBetween(a, b) === BLOCK_SEPARATOR.length
}

export function addDragRow(value: string, rows: Token[], afterIndex: number): string {
	if (rows.length === 0) return value + BLOCK_SEPARATOR

	if (afterIndex >= rows.length - 1) {
		return value === '' ? BLOCK_SEPARATOR + BLOCK_SEPARATOR : value + BLOCK_SEPARATOR
	}

	const insertPos = rows[afterIndex + 1].position.start
	return value.slice(0, insertPos) + BLOCK_SEPARATOR + value.slice(insertPos)
}

export function deleteDragRow(value: string, rows: Token[], index: number): string {
	if (rows.length <= 1) return ''

	if (index >= rows.length - 1) {
		return value.slice(0, rows[index - 1].position.end)
	}

	return value.slice(0, rows[index].position.start) + value.slice(rows[index + 1].position.start)
}

export function duplicateDragRow(value: string, rows: Token[], index: number): string {
	const row = rows[index]
	const rowText = value.substring(row.position.start, row.position.end)

	if (index >= rows.length - 1) {
		return value + separatorBetween(row, row) + rowText
	}

	const next = rows[index + 1]
	const sep = gapBetween(row, next) === 0 ? '' : separatorBetween(row, row)
	return value.slice(0, next.position.start) + rowText + sep + value.slice(next.position.start)
}

/**
 * Returns the raw-value position of the join point between row[index-1] and row[index]
 * for use as the caret position after a merge.
 */
export function getMergeDragRowJoinPos(rows: Token[], index: number): number {
	if (index <= 0 || index >= rows.length) return 0
	return rows[index - 1].position.end
}

/**
 * Merges row[index] into row[index - 1] by removing the separator between them.
 */
export function mergeDragRows(value: string, rows: Token[], index: number): string {
	if (index <= 0 || index >= rows.length) return value
	const prev = rows[index - 1]
	const curr = rows[index]
	return value.slice(0, prev.position.end) + value.slice(curr.position.start)
}

/**
 * Reorders rows by moving the row at `sourceIndex` to `targetIndex`.
 * Separators between adjacent rows are determined by their types.
 */
export function reorderDragRows(value: string, rows: Token[], sourceIndex: number, targetIndex: number): string {
	if (sourceIndex === targetIndex || sourceIndex === targetIndex - 1) return value
	if (rows.length < 2) return value
	if (sourceIndex < 0 || sourceIndex >= rows.length) return value
	if (targetIndex < 0 || targetIndex > rows.length) return value

	const texts = rows.map(row => value.substring(row.position.start, row.position.end))

	const reordered = [...rows]
	const [movedRow] = reordered.splice(sourceIndex, 1)
	const [movedText] = texts.splice(sourceIndex, 1)

	const insertAt = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex
	reordered.splice(insertAt, 0, movedRow)
	texts.splice(insertAt, 0, movedText)

	const parts: string[] = []
	for (let i = 0; i < texts.length; i++) {
		parts.push(texts[i])
		if (i < texts.length - 1) {
			parts.push(separatorBetween(reordered[i], reordered[i + 1]))
		}
	}

	return parts.join('')
}

export {isTextRow}