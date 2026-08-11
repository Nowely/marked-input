import type {CoreOption, DragAction} from '../../shared/types'
import type {MarkNode, TreeNode} from '../tokens'
import {createRowContent} from './createRowContent'

export type DragApplyResult = {
	readonly value: string
	readonly caret: number | undefined
}

function gapText(value: string, a: TreeNode, b: TreeNode): string {
	return value.substring(a.position.end, b.position.start)
}

function isSlotLeadingMark(node: TreeNode): node is MarkNode {
	return node.kind === 'mark' && node.descriptor.hasSlot && node.descriptor.segments.length === 1
}

/**
 * Returns whether two adjacent rows can be merged (Backspace/Delete).
 * Text rows merge when there's a gap between them.
 * Slot-leading mark rows of the same descriptor merge by removing the first mark's suffix.
 */
export function canMergeRows(a: TreeNode, b: TreeNode): boolean {
	if (a.kind === 'text' && b.kind === 'text' && b.position.start > a.position.end) return true
	if (isSlotLeadingMark(a) && isSlotLeadingMark(b) && a.descriptor === b.descriptor) return true
	return false
}

export function addDragRow(
	value: string,
	rows: readonly TreeNode[],
	afterIndex: number,
	newRowContent: string
): string {
	if (value === '' || (rows.length === 1 && rows[0].kind === 'text' && rows[0].text() === ''))
		return newRowContent + newRowContent
	if (afterIndex >= rows.length - 1) return value + newRowContent

	const insertPos = rows[afterIndex + 1].position.start
	return value.slice(0, insertPos) + newRowContent + value.slice(insertPos)
}

export function deleteDragRow(value: string, rows: readonly TreeNode[], index: number): string {
	if (rows.length <= 1) return ''

	if (index >= rows.length - 1) {
		return value.slice(0, rows[index - 1].position.end)
	}

	return value.slice(0, rows[index].position.start) + value.slice(rows[index + 1].position.start)
}

function duplicateDragRow(value: string, rows: TreeNode[], index: number): string {
	const row = rows[index]
	const rowText = value.substring(row.position.start, row.position.end)

	if (index >= rows.length - 1) return value + rowText

	const next = rows[index + 1]
	const gap = gapText(value, row, next)
	return value.slice(0, next.position.start) + rowText + gap + value.slice(next.position.start)
}

/**
 * Merges row[index] into row[index - 1] by removing the boundary between them.
 * For text rows: removes the gap between them.
 * For slot-leading marks: removes the first mark's literal suffix, merging slot content.
 * Returns the new value and the raw-value caret position at the join point.
 */
export function mergeDragRows(value: string, rows: readonly TreeNode[], index: number): {value: string; caret: number} {
	if (index <= 0 || index >= rows.length) return {value, caret: 0}
	const prev = rows[index - 1]
	const curr = rows[index]
	if (isSlotLeadingMark(prev) && isSlotLeadingMark(curr)) {
		const slotEnd = prev.slotRange ? prev.slotRange.end : prev.position.end
		return {value: value.slice(0, slotEnd) + value.slice(curr.position.start), caret: slotEnd}
	}
	const caret = prev.position.end
	return {value: value.slice(0, caret) + value.slice(curr.position.start), caret}
}

/**
 * Reorders rows by moving the row at `sourceIndex` to `targetIndex`.
 * Gaps between adjacent rows are extracted from the original value and preserved.
 */
function reorderDragRows(value: string, rows: TreeNode[], sourceIndex: number, targetIndex: number): string {
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

export function applyDragAction(
	value: string,
	rows: readonly TreeNode[],
	action: DragAction,
	options: CoreOption[]
): DragApplyResult {
	// The EMPTY-TREE add, stated rather than threaded. Until S2.8 an `EMPTY_TEXT_TOKEN`
	// stand-in row was spliced in here and travelled through both helpers below; a
	// `TreeNode` has an id and a signal-backed `text`, so the same trick would mean
	// forging a node. It was never worth one: with no row to address, both answers are
	// constants, and these are exactly the two the sentinel produced — `addDragRow`'s
	// empty-row arm (the row content twice, value ignored) and a caret at that row's
	// end, 0.
	if (action.type === 'add' && rows.length === 0) {
		const rowContent = createRowContent(options)
		return {value: rowContent + rowContent, caret: 0}
	}
	const newValue = transformValue(value, rows, action, options)
	const caret = caretAfterDrag(action, rows, newValue)
	return {value: newValue, caret}
}

function transformValue(value: string, rows: readonly TreeNode[], action: DragAction, options: CoreOption[]): string {
	switch (action.type) {
		case 'reorder':
			return reorderDragRows(value, [...rows], action.source, action.target)
		case 'add':
			return addDragRow(value, rows, action.afterIndex, createRowContent(options))
		case 'delete':
			return deleteDragRow(value, rows, action.index)
		case 'duplicate':
			return duplicateDragRow(value, [...rows], action.index)
	}
}

function caretAfterDrag(action: DragAction, previousRows: readonly TreeNode[], nextValue: string): number | undefined {
	switch (action.type) {
		case 'add': {
			const after = previousRows.at(action.afterIndex)
			return after ? after.position.end : nextValue.length
		}
		case 'duplicate': {
			const row = previousRows.at(action.index)
			return row?.position.end
		}
		case 'delete': {
			const next =
				previousRows.at(action.index + 1) ?? (action.index > 0 ? previousRows.at(action.index - 1) : undefined)
			return next ? Math.min(next.position.start, nextValue.length) : 0
		}
		case 'reorder': {
			const moved = previousRows.at(action.source)
			return moved ? Math.min(moved.position.start, nextValue.length) : undefined
		}
	}
}