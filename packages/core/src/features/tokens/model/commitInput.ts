import type {Token} from '../parser/types'
import type {ReconcileResult} from '../tokenIdentity'

/**
 * One handle refresh the text branch performs. `patch` also writes the DOM
 * surface; without it the entry is a position-only refresh (reconcile's
 * `kind: 'update'`), which is SKIPPED rather than escalated when the id has no
 * handle yet — an unrendered token has no surface to patch.
 */
export type CommitChange = {readonly id: number; readonly token: Token; readonly patch: boolean}

/**
 * The `changed` payload (spec §2.3) and the pipeline's delta carrier — one
 * type, because they are the same three id lists.
 *
 * Granularity is NORMATIVE and differs per field — every lowering must match
 * it, or the fold lies and the two producers cannot be compared:
 *
 * - `added` / `removed` — SUBTREE-INCLUSIVE: a born or dead mark contributes
 *   every descendant id. An ID feed must flatten where a NODE feed need not
 *   (`TransactionResult.added` carries subtree ROOTS — the node hands you the
 *   subtree, a bare id gives a consumer nothing to walk), so a lowering off a
 *   node feed walks the subtree itself. The two fields must agree with each
 *   other above all: `commit.ts`'s `foldDelta` cancels an add against a removal
 *   BY EXACT ID, so a roots-only `added` folded against a subtree-inclusive
 *   `removed` would announce descendant removals for ids the consumer was
 *   never told existed.
 * - `updated` — PER NODE, no subtree claim: an id is listed iff that node's own
 *   content/props changed. A refused-descend mark lists itself ALONE
 *   (`tokenIdentity.ts:154`) even though the repaint it forces covers its
 *   children — a consumer needing the subtree re-reads the tree.
 */
export type TokenDelta = {
	readonly added: readonly number[]
	readonly removed: readonly number[]
	readonly updated: readonly number[]
}

/**
 * What {@link CommitPipeline.apply} consumes — deliberately producer-agnostic
 * (spec §11 transition mechanics). The live path lowers a `ReconcileResult`
 * here; the tree core lowers a `TransactionResult` in `treeInput.ts`. S1.6a
 * deletes the first lowering along with `tokenIdentity`, and the pipeline never
 * learns which one ran.
 */
export type CommitInput = {
	/** The tree bind projects onto the node layer and the renderer paints. */
	tokens: Token[]
	/**
	 * THE routing bit (spec D9). Not `TransactionResult.structural`, which is
	 * add/remove ONLY: a mark whose value or meta changed adds and removes
	 * nothing, yet must reach the renderer because mark components render those
	 * as framework props. `render` is that union.
	 */
	render: boolean
	/**
	 * Handle/DOM refreshes for the text branch. ORDER IS NOT SIGNIFICANT: every
	 * entry is an absolute write to a distinct node (see treeInput.ts).
	 */
	changes: readonly CommitChange[]
	/** What this commit did to the id space — announced (merged across a fold) as the `changed` payload. */
	delta: TokenDelta
}

/**
 * The live path's lowering. Deleted with `tokenIdentity` at S1.6a.
 *
 * `result.structural` already IS the render bit: reconcile sets it for an add
 * (tokenIdentity.ts:318), a removal (:325) and a refused-descend MARK (:153).
 *
 * The delta's subtree contract costs nothing here: reconcile already recurses
 * both id feeds — `collectChanges` emits one `'add'` entry PER NODE of a new
 * subtree (tokenIdentity.ts:134-140) and `collectRemovedIds` the same for a
 * dead one (:143-146).
 */
export function fromReconcile(result: ReconcileResult): CommitInput {
	return {
		tokens: result.tokens,
		render: result.structural,
		changes: result.changes.map(change => ({
			id: change.id,
			token: change.token,
			patch: change.kind !== 'update',
		})),
		delta: {
			// `kind: 'add'` is reconcile's only add signal, and it lands once per
			// node of the new subtree — no walk needed to satisfy the contract.
			// `'text'` is the content signal (a refused-descend MARK included);
			// `'update'` is position-only and is NOT a content change.
			added: result.changes.filter(change => change.kind === 'add').map(change => change.id),
			removed: result.removedIds,
			updated: result.changes.filter(change => change.kind === 'text').map(change => change.id),
		},
	}
}