import {untracked} from '../../../shared/signals'
import type {Token} from '../parser/types'
import {materializeNode} from './snapshot'
import type {Id, TransactionResult, TreeNode} from './types'

/**
 * Spec D9's compat snapshot memo: `tokens.current()` re-materializes only what
 * the adoption actually changed, so an unchanged subtree keeps its Token object
 * and identity-keyed consumers can skip it.
 *
 * Invalidation is two mechanisms, and BOTH are load-bearing (see
 * snapshotMemo.spec.ts for the measured fixtures):
 *
 * - explicit dirty ids from `updated`, plus `shifted` walked SUBTREE-INCLUSIVELY,
 *   because `shifted` carries subtree roots only and a root's delta is NOT its
 *   descendants' ('@[x](ab)t' → '@[xy](ab)t' moves the mark's start by 0 and its
 *   slot child's by 1, and lists the child in neither feed);
 * - child-REFERENCE comparison at materialization, which is what invalidates
 *   ancestors: `TreeNode` has no parent link, and a length-preserving in-slot
 *   edit ('#[ab]t' → '#[cb]t') changes a mark's `content` and `slot.content`
 *   while the mark itself appears in no feed and does not move.
 *
 * `added` needs nothing: a fresh node has no cache entry, and its ancestors
 * re-materialize because their children array is no longer element-identical.
 *
 * One memo belongs to one tree and outlives every adoption on it: reuse is
 * exactly the cache surviving across commits.
 */
export interface SnapshotMemo {
	/** Materialize the roots, reusing every token whose node did not change. */
	roots(nodes: readonly TreeNode[]): Token[]
	/** Mark what one adoption touched. Call once per result, BEFORE `roots`. */
	invalidate(result: TransactionResult): void
	/** The cached token for an id, or undefined (never materialized, or evicted). */
	tokenFor(id: Id): Token | undefined
	/**
	 * Every id whose token the last `roots` call RE-MATERIALIZED, with that token —
	 * i.e. exactly the tokens of that snapshot that are not the same object as in
	 * the previous one.
	 *
	 * Exposed because the memo is the only place that knows the SECOND
	 * invalidation mechanism above. `TransactionResult`'s feeds are the first
	 * mechanism alone, so a consumer that refreshes per-node state from them
	 * (`seam/treeInput.ts`) misses precisely the ancestors `sameChildren` exists
	 * for. This is a live view of the memo's own map: valid until the next `roots`
	 * call, which clears it.
	 */
	materialized(): ReadonlyMap<Id, Token>
}

const NO_CHILDREN: Token[] = []

export function createSnapshotMemo(): SnapshotMemo {
	const cache = new Map<Id, Token>()
	const dirty = new Set<Id>()
	const fresh = new Map<Id, Token>()

	const materialize = (node: TreeNode): Token => {
		const children = node.kind === 'mark' ? node.children().map(materialize) : NO_CHILDREN
		const cached = cache.get(node.id)
		if (cached && !dirty.has(node.id) && sameChildren(cached, children)) return cached
		const token = materializeNode(node, children)
		cache.set(node.id, token)
		fresh.set(node.id, token)
		return token
	}

	return {
		// `untracked` for the reason adoption documents: the whole recursion reads
		// node signals, and a caller inside an effect must not subscribe to every
		// node it happened to walk.
		roots: nodes =>
			untracked(() => {
				// Cleared HERE, not after the walk: `materialized()` reports one
				// generation, and the walk below is what fills it.
				fresh.clear()
				const tokens = nodes.map(materialize)
				// LOAD-BEARING, and cheap to lose: without it `dirty` only ever grows,
				// so every node the memo has ever touched re-materializes forever
				// after. The memo stays CORRECT — the whole suite passes — so the
				// only gate is the second-edit half of the first test in the spec.
				dirty.clear()
				return tokens
			}),

		invalidate(result) {
			// `removed` is already flattened (types.ts:72-73), so one pass evicts the
			// whole dead subtree; ids are never reused, so an evicted entry can never
			// be resurrected by a later node.
			for (const id of result.removed) cache.delete(id)
			for (const node of result.updated) dirty.add(node.id)
			for (const node of result.shifted) markSubtree(node, dirty)
		},

		tokenFor: id => cache.get(id),

		materialized: () => fresh,
	}
}

function markSubtree(node: TreeNode, dirty: Set<Id>): void {
	dirty.add(node.id)
	if (node.kind === 'mark') {
		for (const child of untracked(() => node.children())) markSubtree(child, dirty)
	}
}

function sameChildren(cached: Token, children: readonly Token[]): boolean {
	// A cached TEXT token has no children to compare, and a node never changes
	// kind, so the cache can never disagree with the node about it.
	if (cached.type !== 'mark') return true
	return cached.children.length === children.length && cached.children.every((child, i) => child === children[i])
}