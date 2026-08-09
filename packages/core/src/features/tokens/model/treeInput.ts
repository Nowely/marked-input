import {untracked} from '../../../shared/signals/index.js'
import type {SnapshotMemo} from '../tree/snapshotMemo'
import type {TransactionResult, TreeNode} from '../tree/types'
import type {CommitChange, CommitInput} from './commitInput'

/**
 * The tree core's lowering into the one commit pipeline (spec D9), sibling to
 * `fromReconcile`. Runs inside `Boundary.onResult`, i.e. synchronously at
 * adoption — §4.4 requires `tokens.current()` to stay consistent with
 * `value.current()`, and seven live call sites slice the value by positions read
 * from the snapshot.
 *
 * Routing is `result.render`, NOT `result.structural`: the latter is add/remove
 * only, while a mark whose value or meta changed renders new framework props
 * and must reach the renderer (adopt.ts:197-198; pinned in treeInput.spec.ts).
 */
export function fromTransaction(
	result: TransactionResult,
	memo: SnapshotMemo,
	roots: readonly TreeNode[]
): CommitInput {
	memo.invalidate(result)
	const tokens = memo.roots(roots)

	const changes: CommitChange[] = []
	const added: number[] = []
	const seen = new Set<number>()

	const push = (node: TreeNode, patch: boolean): void => {
		if (seen.has(node.id)) return
		const token = memo.tokenFor(node.id)
		// Unreachable in practice — `memo.roots` above walked every live node — but
		// `tokenFor` is typed optional and a silent skip beats a throw on a datum
		// the pipeline only uses to refresh a cache.
		if (!token) return
		seen.add(node.id)
		changes.push({id: node.id, token, patch})
	}

	// `untracked` for the reason adoption documents: the walks below read node
	// signals, and a caller inside an effect must not subscribe to every node it
	// happened to touch.
	untracked(() => {
		// Content first, so a node listed in BOTH feeds is emitted as a patch. Order
		// between entries is NOT significant (spec: `shifted` is unordered, measured
		// as reverse-document suffix run then document-order middle): every entry is
		// an absolute write to a distinct node.
		for (const node of result.updated) push(node, true)
		// `shifted` carries subtree ROOTS only; descendants moved with it and their
		// stored positions are what the DOM boundary layer reads, so walk them.
		for (const root of result.shifted) walk(root, node => push(node, false))
		// The same walk, for the other half of `TokenDelta`'s granularity rule:
		// `added` is SUBTREE-INCLUSIVE while `TransactionResult.added` carries
		// subtree roots. Roots-only here would make `foldDelta`'s by-id cancel
		// partial — a mark born and killed inside one pending window would clear
		// only its root, leaving descendant ids in `removed` (which IS flattened)
		// and announcing removals the consumer was never told about.
		for (const change of result.added) walk(change.node, node => added.push(node.id))
	})

	return {
		tokens,
		render: result.render,
		changes,
		delta: {
			added,
			// Already flattened by adoption (types.ts:72-73).
			removed: result.removed,
			// PER NODE, no walk: a mark listed here reports its own changed props,
			// not its subtree's (see TokenDelta).
			updated: result.updated.map(node => node.id),
		},
	}
}

function walk(node: TreeNode, visit: (node: TreeNode) => void): void {
	visit(node)
	if (node.kind === 'mark') {
		for (const child of node.children()) walk(child, visit)
	}
}