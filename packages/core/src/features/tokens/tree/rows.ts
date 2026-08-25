import type {RowNode, TreeNode} from './types'

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
		out.push(...preorderRows(node.rows(), depth + 1))
	}
	return out
}