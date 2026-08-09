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

	// ONE invalidation feed, and it is the MEMO's, not the transaction's. A change
	// entry exists to hand a handle the generation the DOM now shows, so the set
	// that needs one is exactly "the tokens of this snapshot that are new objects" —
	// which is what `materialized()` reports. Deriving it from `updated` + `shifted`
	// instead covers only the memo's FIRST invalidation mechanism and silently drops
	// the second: an ancestor mark caught by `sameChildren` alone ('#[ab]t' →
	// '#[cb]t' changes a mark's `content` and `slot` while the mark is in neither
	// feed and does not move) would keep a token the DOM no longer shows — `render`
	// is false so nothing re-binds, and `assertAligned` is blind because bind gives
	// a mark no `textElement` (bind.ts:162). Gated in treePipeline.spec.ts against
	// the live lowering.
	//
	// Order between entries is NOT significant: every entry is an absolute write to
	// a distinct node, and the old dedupe of a node listed in both feeds is
	// structural now — `materialized()` is keyed by id.
	//
	// `updated` is the only PATCH signal. Patch also WRITES the DOM surface, and a
	// node re-materialized merely because it moved, or because a descendant changed,
	// has no surface write to make.
	const patched = new Set(result.updated.map(node => node.id))
	const changes: CommitChange[] = [...memo.materialized()].map(([id, token]) => ({
		id,
		token,
		patch: patched.has(id),
	}))

	const added: number[] = []
	// `untracked` for the reason adoption documents: the walk below reads node
	// signals, and a caller inside an effect must not subscribe to every node it
	// happened to touch.
	untracked(() => {
		// `TokenDelta`'s granularity rule: `added` is SUBTREE-INCLUSIVE while
		// `TransactionResult.added` carries subtree roots. Roots-only here would make
		// `foldDelta`'s by-id cancel partial — a mark born and killed inside one
		// pending window would clear only its root, leaving descendant ids in
		// `removed` (which IS flattened) and announcing removals the consumer was
		// never told about.
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
			// not its subtree's (see TokenDelta). Deliberately `result.updated` and NOT
			// the memo's set, which is subtree- AND ancestor-inclusive by design.
			updated: [...patched],
		},
	}
}

function walk(node: TreeNode, visit: (node: TreeNode) => void): void {
	visit(node)
	if (node.kind === 'mark') {
		for (const child of node.children()) walk(child, visit)
	}
}