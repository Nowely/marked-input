import type {CoreOption, DragAction} from '../../shared/types'
import type {MarkNode, NodeAnchor, TreeNode} from '../tokens'
import {createRowContent} from './createRowContent'

/** An anchor-addressed slice of the document — backed by `tokens.valueBetween` in production. */
export type SliceRead = (from: NodeAnchor, to: NodeAnchor) => string

export type DragApplyResult = {
	readonly value: string
	readonly caret: number
}

function isSlotLeadingMark(node: TreeNode): node is MarkNode {
	return node.kind === 'mark' && node.descriptor.hasSlot && node.descriptor.segments.length === 1
}

/**
 * Returns whether two adjacent rows can be merged (Backspace/Delete).
 * Text rows merge when there's a gap between them.
 * Slot-leading mark rows of the same descriptor merge by removing the first mark's suffix.
 */
export function canMergeRows(read: SliceRead, a: TreeNode, b: TreeNode): boolean {
	if (a.kind === 'text' && b.kind === 'text' && read({after: a}, {before: b}) !== '') return true
	if (isSlotLeadingMark(a) && isSlotLeadingMark(b) && a.descriptor === b.descriptor) return true
	return false
}

/**
 * The document as per-row texts and inter-row gaps, read through anchors — the
 * tree's own string, never the props-first `value()`. Recomposition is
 * `texts[0] + gaps[0] + texts[1] + …`; every operation below edits these arrays
 * and derives its caret from the parts it kept, so the caret always indexes the
 * string it returns.
 *
 * A live tree's roots TILE the document, so every gap is `''` there. The channel
 * is what keeps that from being an assumption: a non-tiling tree composes back to
 * itself instead of silently losing the text between two rows.
 */
function project(read: SliceRead, rows: readonly TreeNode[]): {texts: string[]; gaps: string[]} {
	const texts = rows.map(row => read({before: row}, {after: row}))
	const gaps = rows.slice(0, -1).map((row, i) => read({after: row}, {before: rows[i + 1]}))
	return {texts, gaps}
}

function compose(texts: readonly string[], gaps: readonly string[]): string {
	const parts: string[] = []
	texts.forEach((text, i) => {
		parts.push(text)
		if (i < gaps.length) parts.push(gaps[i])
	})
	return parts.join('')
}

/** Length of the composition up to (not including) row `index` — the row's start in the composed string. */
function startOf(texts: readonly string[], gaps: readonly string[], index: number): number {
	let total = 0
	for (let i = 0; i < index; i++) {
		total += texts[i].length
		if (i < gaps.length) total += gaps[i].length
	}
	return total
}

/** Splice `content` in as row `at`, with an empty gap holding it apart from its new neighbour. */
function insertRow(
	texts: readonly string[],
	gaps: readonly string[],
	at: number,
	content: string
): {newTexts: string[]; newGaps: string[]} {
	return {
		newTexts: [...texts.slice(0, at), content, ...texts.slice(at)],
		newGaps: at >= texts.length ? [...gaps, ''] : [...gaps.slice(0, at), '', ...gaps.slice(at)],
	}
}

/** Removes row `index` along with the boundary that held it. Total: the index is the caller's to validate. */
function deleteRow(texts: readonly string[], gaps: readonly string[], index: number): DragApplyResult {
	if (texts.length <= 1) return {value: '', caret: 0}
	const keptTexts = texts.filter((_, i) => i !== index)
	const keptGaps = gaps.filter((_, i) => i !== Math.min(index, gaps.length - 1))
	const value = compose(keptTexts, keptGaps)
	// The row that takes the deleted row's place — the next one when it exists,
	// else the end of the new last row.
	const caret = index < keptTexts.length ? startOf(keptTexts, keptGaps, index) : value.length
	return {value, caret}
}

/**
 * Actions with nothing to write: a no-op drop, or a row index no row answers to.
 * Judged BEFORE {@link project}, which costs one slice read per row.
 */
function isApplicable(rows: readonly TreeNode[], action: DragAction): boolean {
	if (action.type === 'reorder') {
		const {source, target} = action
		// `target - 1` is the drop on the row's own trailing edge: it lands where it already is.
		if (source === target || source === target - 1) return false
		return rows.length >= 2 && source >= 0 && source < rows.length && target >= 0 && target <= rows.length
	}
	if (action.type === 'add') return true
	// delete | duplicate: both address one row by index.
	return action.index >= 0 && action.index < rows.length
}

/**
 * Applies a drag action, composing the new document from anchor-slice reads of the
 * current one. `undefined` means there is nothing to write — see {@link isApplicable} —
 * and is the signal the caller skips its commit on.
 */
export function applyDragAction(
	read: SliceRead,
	rows: readonly TreeNode[],
	action: DragAction,
	options: CoreOption[]
): DragApplyResult | undefined {
	// The EMPTY-TREE add, stated rather than composed: with no row to address both
	// answers are constants — the row content twice, and a caret at that row's start.
	if (action.type === 'add' && rows.length === 0) {
		const rowContent = createRowContent(options)
		return {value: rowContent + rowContent, caret: 0}
	}
	if (!isApplicable(rows, action)) return undefined
	const {texts, gaps} = project(read, rows)

	switch (action.type) {
		case 'delete':
			return deleteRow(texts, gaps, action.index)
		case 'duplicate': {
			// The copy glues to its original; the original's own separator stays with it,
			// ahead of the row that followed.
			const newTexts = [
				...texts.slice(0, action.index + 1),
				texts[action.index],
				...texts.slice(action.index + 1),
			]
			const newGaps = [...gaps.slice(0, action.index), '', ...gaps.slice(action.index)]
			return {value: compose(newTexts, newGaps), caret: startOf(newTexts, newGaps, action.index + 1)}
		}
		case 'add': {
			const at = Math.min(action.afterIndex + 1, texts.length)
			const {newTexts, newGaps} = insertRow(texts, gaps, at, createRowContent(options))
			return {value: compose(newTexts, newGaps), caret: startOf(newTexts, newGaps, at)}
		}
		case 'reorder': {
			const {source, target} = action
			const newTexts = [...texts]
			const [moved] = newTexts.splice(source, 1)
			const insertAt = target > source ? target - 1 : target
			newTexts.splice(insertAt, 0, moved)
			const newGaps = [...gaps]
			newGaps.splice(Math.min(source, newGaps.length - 1), 1)
			// Marks are self-delimiting, so the moved row lands with an empty gap.
			if (insertAt < newTexts.length - 1) newGaps.splice(insertAt, 0, '')
			return {value: compose(newTexts, newGaps), caret: startOf(newTexts, newGaps, insertAt)}
		}
		default: {
			const unhandled: never = action
			return unhandled
		}
	}
}

/**
 * Merges row[index] into row[index - 1] by removing the boundary between them.
 * For text rows: removes the gap. For slot-leading marks: removes the first
 * mark's literal suffix, merging slot content. The within-row offset arithmetic
 * (`slotRange.end - position.start`) indexes the row's OWN slice — positions and
 * the slice come from one tree generation, so the pair is self-consistent.
 */
export function mergeDragRows(read: SliceRead, rows: readonly TreeNode[], index: number): DragApplyResult {
	const {texts, gaps} = project(read, rows)
	if (index <= 0 || index >= rows.length) return {value: compose(texts, gaps), caret: 0}
	const prev = rows[index - 1]
	// The merged-in row and everything after it, untouched.
	const tail = compose(texts.slice(index), gaps.slice(index))

	if (isSlotLeadingMark(prev) && isSlotLeadingMark(rows[index])) {
		// Everything before the previous row, ITS leading gap included: what goes is
		// the previous mark's suffix, and the gap between the pair along with it.
		const head = compose(texts.slice(0, index - 1), gaps.slice(0, index - 1))
		const slotEnd = (prev.slotRange ? prev.slotRange.end : prev.position.end) - prev.position.start
		const keptPrev = texts[index - 1].slice(0, slotEnd)
		return {value: head + keptPrev + tail, caret: head.length + keptPrev.length}
	}

	// Rows 0..index-1 with their gaps EXCEPT the merged boundary's, then the merged-in row.
	const head = compose(texts.slice(0, index), gaps.slice(0, index - 1))
	return {value: head + tail, caret: head.length}
}

/** Insert `content` as a row after `afterIndex`; caret at the END of the inserted content (blockEdit's Enter on a mark row). */
export function addDragRow(
	read: SliceRead,
	rows: readonly TreeNode[],
	afterIndex: number,
	content: string
): DragApplyResult {
	const {texts, gaps} = project(read, rows)
	const at = Math.min(afterIndex + 1, texts.length)
	const {newTexts, newGaps} = insertRow(texts, gaps, at, content)
	return {value: compose(newTexts, newGaps), caret: startOf(newTexts, newGaps, at) + content.length}
}

/** Removes row `index`; the caller (blockEdit's Backspace on an empty row) has already resolved it. */
export function deleteDragRow(read: SliceRead, rows: readonly TreeNode[], index: number): DragApplyResult {
	const {texts, gaps} = project(read, rows)
	return deleteRow(texts, gaps, index)
}