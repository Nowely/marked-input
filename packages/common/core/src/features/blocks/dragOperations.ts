import {BLOCK_SEPARATOR} from './config'
import type {Block} from './splitTokensIntoDragRows'

/**
 * In drag mode the gap between two adjacent rows can be:
 *   0  — marks are auto-delimited by their syntax (no separator needed)
 *   2  — `\n\n` required between two text rows
 *
 * These helpers mirror the `blockOperations` API but account for 0-gap adjacency.
 */

function rowGap(rows: Block[], index: number): number {
	if (index >= rows.length - 1) return 0
	return rows[index + 1].startPos - rows[index].endPos
}

function isTextRow(row: Block): boolean {
	return row.tokens.length === 0 || row.tokens[0].type === 'text'
}

/**
 * Returns the separator that should sit between row[a] and row[b] in the value.
 * Text-text pairs need `\n\n`; everything else is adjacent with no separator.
 */
function separatorBetween(a: Block, b: Block): string {
	return isTextRow(a) && isTextRow(b) ? BLOCK_SEPARATOR : ''
}

export function addDragRow(value: string, rows: Block[], afterIndex: number): string {
	if (rows.length === 0) return value + BLOCK_SEPARATOR

	if (afterIndex >= rows.length - 1) {
		return value === '' ? BLOCK_SEPARATOR + BLOCK_SEPARATOR : value + BLOCK_SEPARATOR
	}

	const curr = rows[afterIndex]
	const next = rows[afterIndex + 1]
	const gap = next.startPos - curr.endPos

	if (gap === 0) {
		return value.slice(0, curr.endPos) + BLOCK_SEPARATOR + value.slice(next.startPos)
	}

	return value.slice(0, next.startPos) + BLOCK_SEPARATOR + value.slice(next.startPos)
}

export function deleteDragRow(value: string, rows: Block[], index: number): string {
	if (rows.length <= 1) return ''

	if (index >= rows.length - 1) {
		// Last row: trim back to previous row's endPos.
		return value.slice(0, rows[index - 1].endPos)
	}

	// Remove from this row's startPos to the next row's startPos.
	// This removes the row content and any gap (0 or `\n\n`) after it.
	// The gap before it (from prev to curr) becomes the new gap between prev and next.
	return value.slice(0, rows[index].startPos) + value.slice(rows[index + 1].startPos)
}

export function duplicateDragRow(value: string, rows: Block[], index: number): string {
	const row = rows[index]
	const rowText = value.substring(row.startPos, row.endPos)

	if (index >= rows.length - 1) {
		const sep = isTextRow(row) ? BLOCK_SEPARATOR : BLOCK_SEPARATOR
		return value + sep + rowText
	}

	const next = rows[index + 1]
	const gap = next.startPos - row.endPos
	const sep = gap === 0 ? '' : BLOCK_SEPARATOR
	// Insert: rowText + appropriate separator + (existing gap preserved in slice)
	return value.slice(0, next.startPos) + rowText + sep + value.slice(next.startPos)
}

/**
 * Returns the raw-value position of the join point between row[index-1] and row[index]
 * for use as the caret position after a merge.
 * Only meaningful for text-text merges (gap = 2).
 */
export function getMergeDragRowJoinPos(rows: Block[], index: number): number {
	if (index <= 0 || index >= rows.length) return 0
	return rows[index - 1].endPos
}

/**
 * Merges row[index] into row[index - 1] by removing the `\n\n` separator between them.
 * Only has an effect when both rows are text rows (gap = 2).
 */
export function mergeDragRows(value: string, rows: Block[], index: number): string {
	if (index <= 0 || index >= rows.length) return value
	const prev = rows[index - 1]
	const curr = rows[index]
	// Remove everything between prev.endPos and curr.startPos (the `\n\n` separator).
	return value.slice(0, prev.endPos) + value.slice(curr.startPos)
}

/**
 * Reorders rows by moving the row at `sourceIndex` to `targetIndex`.
 * After reordering, separator between adjacent rows is determined by their types:
 *   text + text → `\n\n`
 *   anything else → `""` (marks are auto-delimited)
 */
export function reorderDragRows(value: string, rows: Block[], sourceIndex: number, targetIndex: number): string {
	if (sourceIndex === targetIndex || sourceIndex === targetIndex - 1) return value
	if (rows.length < 2) return value
	if (sourceIndex < 0 || sourceIndex >= rows.length) return value
	if (targetIndex < 0 || targetIndex > rows.length) return value

	// Extract raw text for each row
	const texts = rows.map(row => value.substring(row.startPos, row.endPos))

	// Reorder
	const reordered = [...rows]
	const [movedRow] = reordered.splice(sourceIndex, 1)
	const [movedText] = texts.splice(sourceIndex, 1)

	const insertAt = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex
	reordered.splice(insertAt, 0, movedRow)
	texts.splice(insertAt, 0, movedText)

	// Reassemble with correct separators
	const parts: string[] = []
	for (let i = 0; i < texts.length; i++) {
		parts.push(texts[i])
		if (i < texts.length - 1) {
			parts.push(separatorBetween(reordered[i], reordered[i + 1]))
		}
	}

	return parts.join('')
}

// Re-export gap helper for use in KeyDownController
export {rowGap, isTextRow}