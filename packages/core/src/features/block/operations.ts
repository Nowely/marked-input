import type {NodeAnchor, TreeNode} from '../tokens'

/** An anchor-addressed slice of the document — backed by `tokens.valueBetween` in production. */
type SliceRead = (from: NodeAnchor, to: NodeAnchor) => string

type DragApplyResult = {
	readonly value: string
	/** Index of the row the caret enters in the RESULT — a node the commit is about to produce, never a character offset. */
	readonly row: number
}

/**
 * The two adds no anchor can name.
 *
 * An EMPTY tree has no row to insert after; a NEGATIVE `afterIndex` means before the first
 * row, which `insertAfter` cannot express. Neither is reachable from the block menu, whose
 * `addBlock` passes its own row index — they are kept composed rather than approximated by a
 * verb, so no input changes answer. The composition is two slices of the tree's own string
 * (never the props-first `value()`) around the one cut the insertion names.
 */
export function addRowUnanchored(
	read: SliceRead,
	rows: readonly TreeNode[],
	afterIndex: number,
	separator: string
): DragApplyResult {
	// Stated rather than composed: with no row to address, both answers are constants.
	// One separator IS two rows under issue 08's trailing convention — an empty
	// terminated row plus the empty document-final one — with the caret in the first.
	if (rows.length === 0) {
		return {value: separator, row: 0}
	}
	const at = Math.max(Math.min(afterIndex + 1, rows.length), 0)
	const cut: NodeAnchor = at === 0 ? 'start' : {after: rows[at - 1]}
	return {value: read('start', cut) + separator + read(cut, 'end'), row: at}
}