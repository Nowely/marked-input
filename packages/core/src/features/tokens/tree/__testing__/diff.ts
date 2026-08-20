import type {Id, TreeNode} from '../types'

/**
 * TEST-ONLY identity oracle. The production change feed
 * (`TransactionResult.added/removed/updated`) was deleted with zero runtime readers; the
 * identity assertions it powered now diff a pre-adoption capture against the live tree,
 * which gates what actually HAPPENED to the tree rather than what adoption claimed.
 *
 * The capture is a pre-order document walk, so `removed` below reports a vanished mark
 * followed by its descendants — the same subtree-flattened order the feed carried.
 */
export type TreeCapture = Map<Id, string>

/** Per id, everything a signal write on that node could change: text, or value+meta. */
export function captureTree(nodes: readonly TreeNode[], into: TreeCapture = new Map()): TreeCapture {
	for (const node of nodes) {
		into.set(
			node.id,
			node.kind === 'text'
				? node.text()
				: node.kind === 'row'
					? node.terminator
					: JSON.stringify([node.value(), node.meta()])
		)
		if (node.kind !== 'text') captureTree(node.children(), into)
	}
	return into
}

export interface TreeDiff {
	/** Subtree ROOTS with their post-adoption paths: the children of a fresh mark are new with it. */
	added: {node: TreeNode; path: number[]}[]
	/** Ids that left the tree, subtree-inclusive, in pre-adoption document order. */
	removed: Id[]
	/** Retained nodes whose own content (text, or value/meta) changed, in document order. */
	updated: TreeNode[]
}

export function diffTree(before: TreeCapture, roots: readonly TreeNode[]): TreeDiff {
	const added: TreeDiff['added'] = []
	const updated: TreeNode[] = []
	const after = captureTree(roots)
	const walk = (nodes: readonly TreeNode[], path: readonly number[]): void => {
		nodes.forEach((node, index) => {
			const at = [...path, index]
			const was = before.get(node.id)
			if (was === undefined) {
				added.push({node, path: at})
				return
			}
			if (was !== after.get(node.id)) updated.push(node)
			if (node.kind !== 'text') walk(node.children(), at)
		})
	}
	walk(roots, [])
	return {added, removed: [...before.keys()].filter(id => !after.has(id)), updated}
}