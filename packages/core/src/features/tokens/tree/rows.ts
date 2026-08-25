import type {RowToken} from '../parser/types'
import type {RowNode, TreeNode} from './types'

/**
 * IS THIS ROW'S CHILD LIST ITS OWN BODY — the pieces its kind's split carved — rather than rows
 * nested UNDER it? The one question that separates a table row from a list item, and the tree
 * answers it STRUCTURALLY rather than by holding the declaration: children are inline-then-rows, so
 * a row whose FIRST child is a row has no inline content at all, and a row's own line always parses
 * with at least one text child when it has a line to itself.
 *
 * It decides three readings, and they are the whole of what a carve costs the tree: such a row's
 * body IS its children (so `slot` and `slotRange` read them), its line covers them (so a retype
 * splices the cells with it), and they are NOT rows of the document (so the pre-order join never
 * puts a separator between them).
 */
export function hasCells(row: RowNode): boolean {
	return row.children().at(0)?.kind === 'row'
}

/** {@link hasCells} over the parse. The same shape, read before the tree holds it. */
export function tokenHasCells(token: RowToken): boolean {
	return token.children.length === 0 && token.rows.length > 0
}

/**
 * Every row in document order with its DEPTH — the recursion index, which is the tree's own
 * reading of depth and the only one. It is deliberately NOT derived from `lead`: the two
 * disagree on an over-indented paste, and two facts under one name is what the clamp exists to
 * keep apart.
 *
 * The pre-order walk is what the value's join, the row boundaries and the identity pairing all
 * speak, because a row's subtree is contiguous in document order.
 *
 * Its own module rather than `tree.ts`, and not by preference: `anchors.ts` needs it and `tree.ts`
 * already imports `anchors.ts`, so hosting it there is an import cycle.
 */
export function preorderRows(nodes: readonly TreeNode[], depth = 0): {row: RowNode; depth: number}[] {
	const out: {row: RowNode; depth: number}[] = []
	for (const node of nodes) {
		if (node.kind !== 'row') continue
		out.push({row: node, depth})
		// A CARVED row's children are its body, and this walk is the separator-joined document —
		// the cells of one line are not lines of their own, so nothing that speaks this order (the
		// join, the row boundaries, the identity pairing, the movers) can name one.
		if (!hasCells(node)) out.push(...preorderRows(node.rows(), depth + 1))
	}
	return out
}