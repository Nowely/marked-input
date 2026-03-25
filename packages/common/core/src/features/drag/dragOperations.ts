import type {Token} from '../parsing'

function gapText(value: string, a: Token, b: Token): string {
	return value.substring(a.position.end, b.position.start)
}

/**
 * Returns whether two adjacent text rows can be merged (Backspace/Delete).
 */
export function canMergeRows(a: Token, b: Token): boolean {
	return a.type === 'text' && b.type === 'text' && b.position.start > a.position.end
}

export function addDragRow(value: string, rows: Token[], afterIndex: number, newRowContent: string): string {
	if (rows.length === 0) return value + newRowContent
	if (afterIndex >= rows.length - 1) return value + newRowContent

	const insertPos = rows[afterIndex + 1].position.start
	return value.slice(0, insertPos) + newRowContent + value.slice(insertPos)
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

	if (index >= rows.length - 1) return value + rowText

	const next = rows[index + 1]
	const gap = gapText(value, row, next)
	return value.slice(0, next.position.start) + rowText + gap + value.slice(next.position.start)
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
 * Merges row[index] into row[index - 1] by removing the gap between them.
 */
export function mergeDragRows(value: string, rows: Token[], index: number): string {
	if (index <= 0 || index >= rows.length) return value
	const prev = rows[index - 1]
	const curr = rows[index]
	return value.slice(0, prev.position.end) + value.slice(curr.position.start)
}

/**
 * Reorders rows by moving the row at `sourceIndex` to `targetIndex`.
 * Gaps between adjacent rows are extracted from the original value and preserved.
 */
export function reorderDragRows(value: string, rows: Token[], sourceIndex: number, targetIndex: number): string {
	if (sourceIndex === targetIndex || sourceIndex === targetIndex - 1) return value
	if (rows.length < 2) return value
	if (sourceIndex < 0 || sourceIndex >= rows.length) return value
	if (targetIndex < 0 || targetIndex > rows.length) return value

	const texts = rows.map(row => value.substring(row.position.start, row.position.end))
	const gaps = rows.slice(0, -1).map((row, i) => gapText(value, row, rows[i + 1]))

	const [movedText] = texts.splice(sourceIndex, 1)
	// Remove the gap associated with the source position
	const gapIndex = sourceIndex < gaps.length ? sourceIndex : sourceIndex - 1
	gaps.splice(gapIndex, 1)

	const insertAt = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex
	texts.splice(insertAt, 0, movedText)
	// Insert a gap for the new position (use '' — marks are self-delimiting)
	if (insertAt < texts.length - 1) {
		gaps.splice(insertAt, 0, '')
	}

	const parts: string[] = []
	for (let i = 0; i < texts.length; i++) {
		parts.push(texts[i])
		if (i < gaps.length) {
			parts.push(gaps[i])
		}
	}

	return parts.join('')
}