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
	/** Ids gone from the tree, subtree-inclusive. */
	removedIds: readonly number[]
}

/**
 * The live path's lowering. Deleted with `tokenIdentity` at S1.6a.
 *
 * `result.structural` already IS the render bit: reconcile sets it for an add
 * (tokenIdentity.ts:318), a removal (:325) and a refused-descend MARK (:153).
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
		removedIds: result.removedIds,
	}
}