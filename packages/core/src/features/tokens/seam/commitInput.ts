import type {Token} from '../parser/types'

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
 *   content/props changed. `treeInput.ts` lowers adoption's `updated` feed
 *   straight through, so a mark whose PROJECTION changed while its own fields did
 *   not stays out of the list (`treeInput.spec.ts`'s ANCESTOR case) — a consumer
 *   needing the subtree re-reads the tree.
 */
export type TokenDelta = {
	readonly added: readonly number[]
	readonly removed: readonly number[]
	readonly updated: readonly number[]
}

/**
 * What {@link CommitPipeline.apply} consumes. ONE producer remains — S1.6a
 * deleted the reconcile lowering when the tree core took the live path, leaving
 * `treeInput.ts`'s `fromTransaction`. The type stays producer-agnostic anyway:
 * it is the pipeline's input contract, and the pipeline never learns who filled
 * it (spec §11's transition mechanics; the hand-built `CommitInput` in
 * treePipeline.spec.ts exercises exactly that).
 */
export type CommitInput = {
	/** The snapshot the renderer paints and `tokens.current()` serves. */
	tokens: Token[]
	/**
	 * THE routing bit (spec D9), and since S2.7 the pipeline's only question. Not
	 * `TransactionResult.structural`, which is add/remove ONLY: a mark whose value or
	 * meta changed adds and removes nothing, yet must reach the renderer because mark
	 * components render those as framework props. `render` is that union.
	 *
	 * There is no text counterpart any more. A text-only commit reaches the DOM through
	 * the per-surface effects `bind` arms, so the pipeline neither carries nor replays
	 * the changed content: the old `changes: CommitChange[]` feed and its
	 * `commitText` consumer went with the bind generation they fed.
	 */
	render: boolean
	/** What this commit did to the id space — announced (merged across a fold) as the `changed` payload. */
	delta: TokenDelta
}