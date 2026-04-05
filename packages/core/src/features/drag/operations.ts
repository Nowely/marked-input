import type {MarkToken, Token} from '../parsing'

function gapText(value: string, a: Token, b: Token): string {
	return value.substring(a.position.end, b.position.start)
}

function isSlotLeadingMark(token: Token): token is MarkToken {
	return token.type === 'mark' && token.descriptor.hasSlot && token.descriptor.segments.length === 1
}

/**
 * Returns whether two adjacent rows can be merged (Backspace/Delete).
 * Text rows merge when there's a gap between them.
 * Slot-leading mark rows of the same descriptor merge by removing the first mark's suffix.
 */
export function canMergeRows(a: Token, b: Token): boolean {
	if (a.type === 'text' && b.type === 'text' && b.position.start > a.position.end) return true
	if (isSlotLeadingMark(a) && isSlotLeadingMark(b) && a.descriptor === b.descriptor) return true
	return false
}

export function addDragRow(value: string, rows: Token[], afterIndex: number, newRowContent: string): string {
	if (rows.length === 0) return value + newRowContent
	if (value === '' || (rows.length === 1 && rows[0].type === 'text' && rows[0].content === ''))
		return newRowContent + newRowContent
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
	const prev = rows[index - 1]
	if (isSlotLeadingMark(prev) && prev.slot) return prev.slot.end
	return prev.position.end
}

/**
 * Merges row[index] into row[index - 1] by removing the boundary between them.
 * For text rows: removes the gap between them.
 * For slot-leading marks: removes the first mark's literal suffix, merging slot content.
 */
export function mergeDragRows(value: string, rows: Token[], index: number): string {
	if (index <= 0 || index >= rows.length) return value
	const prev = rows[index - 1]
	const curr = rows[index]
	if (isSlotLeadingMark(prev) && isSlotLeadingMark(curr)) {
		const slotEnd = prev.slot ? prev.slot.end : prev.position.end
		return value.slice(0, slotEnd) + value.slice(curr.position.start)
	}
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