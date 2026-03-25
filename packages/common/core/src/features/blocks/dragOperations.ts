import type {Token} from '../parsing'
import {BLOCK_SEPARATOR} from './config'

/**
 * In drag mode the gap between two adjacent rows can be:
 *   0  — marks are auto-delimited by their syntax (no separator needed)
 *   2  — `\n\n` required between two text rows
 *
 * These helpers account for 0-gap adjacency.
 */

function rowGap(rows: Token[], index: number): number {
	if (index >= rows.length - 1) return 0
	return rows[index + 1].position.start - rows[index].position.end
}

function isTextRow(row: Token): boolean {
	return row.type === 'text'
}

/**
 * Returns the separator that should sit between row[a] and row[b] in the value.
 * Text-text pairs need `\n\n`; everything else is adjacent with no separator.
 */
function separatorBetween(a: Token, b: Token): string {
	return isTextRow(a) && isTextRow(b) ? BLOCK_SEPARATOR : ''
}

export function addDragRow(value: string, rows: Token[], afterIndex: number): string {
	if (rows.length === 0) return value + BLOCK_SEPARATOR

	if (afterIndex >= rows.length - 1) {
		return value === '' ? BLOCK_SEPARATOR + BLOCK_SEPARATOR : value + BLOCK_SEPARATOR
	}

	const curr = rows[afterIndex]
	const next = rows[afterIndex + 1]
	const gap = next.position.start - curr.position.end

	if (gap === 0) {
		return value.slice(0, curr.position.end) + BLOCK_SEPARATOR + value.slice(next.position.start)
	}

	return value.slice(0, next.position.start) + BLOCK_SEPARATOR + value.slice(next.position.start)
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
		const sep = isTextRow(row) ? BLOCK_SEPARATOR : BLOCK_SEPARATOR
		return value + sep + rowText
	}

	const next = rows[index + 1]
	const gap = next.position.start - row.position.end
	const sep = gap === 0 ? '' : BLOCK_SEPARATOR
	return value.slice(0, next.position.start) + rowText + sep + value.slice(next.position.start)
}

/**
 * Returns the raw-value position of the join point between row[index-1] and row[index]
 * for use as the caret position after a merge.
 * Only meaningful for text-text merges (gap = 2).
 */
export function getMergeDragRowJoinPos(rows: Token[], index: number): number {
	if (index <= 0 || index >= rows.length) return 0
	return rows[index - 1].position.end
}

/**
 * Merges row[index] into row[index - 1] by removing the `\n\n` separator between them.
 * Only has an effect when both rows are text rows (gap = 2).
 */
export function mergeDragRows(value: string, rows: Token[], index: number): string {
	if (index <= 0 || index >= rows.length) return value
	const prev = rows[index - 1]
	const curr = rows[index]
	return value.slice(0, prev.position.end) + value.slice(curr.position.start)
}

/**
 * Reorders rows by moving the row at `sourceIndex` to `targetIndex`.
 * After reordering, separator between adjacent rows is determined by their types:
 *   text + text → `\n\n`
 *   anything else → `""` (marks are auto-delimited)
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

export {rowGap, isTextRow}