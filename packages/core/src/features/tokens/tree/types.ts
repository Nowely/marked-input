import type {Signal} from '../../../shared/signals'
import type {MarkupDescriptor} from '../parser/core/MarkupDescriptor'
import type {Markup} from '../parser/types'

/** Node identity: assigned at node birth, never reused within an input instance. */
export type Id = number

/**
 * An identity claim the string cannot carry: `pairing[j]` is the index of the PREVIOUS root
 * that becomes new root `j`. ROOT level, and post-filter on both sides — block mode filters
 * empty text tokens one line before adoption (`valueBoundary`), and the tree's own roots are
 * the output of that same filtered list, so both ends of the channel are in one space by
 * construction.
 *
 * It exists because a permutation is not derivable from the two strings. Moving a row past a
 * BYTE-IDENTICAL one produces the same document, so no diff — LCS, keyed or otherwise — can
 * tell that permutation from a no-op. The difference is entirely in which row the user
 * grabbed, and only the caller knows it.
 *
 * A claim, not an instruction: adoption re-derives every pair against the parse and discards
 * the whole pairing if any of it disagrees.
 */
export type Pairing = readonly number[]

/**
 * Replaced range in the PREVIOUS projection plus inserted length, and optionally the identity
 * claim above.
 *
 * `pairing` rides HERE rather than as a parameter of `CommitSink.commit` because `Window` is
 * the one value already recorded and replayed across the controlled echo (`Emission` in
 * `valueBoundary.ts`), released only when the echo matches both the emitted value and the base
 * it was spliced from — which is exactly the condition under which the pairing's previous-root
 * indices are still valid. A parallel channel would need that guard rebuilt beside it.
 */
export type Window = {
	readonly start: number
	readonly end: number
	readonly insertedLength: number
	readonly pairing?: Pairing
}

/**
 * One structure: the same objects flow through adoption and out of the public
 * reads. ADOPTION IS THE ONLY WRITER, for every mutable member — the writable
 * `Signal` fields, which are also the reactive read, and the plain `position`
 * and `slotRange` records alike. A consumer that calls a setter or assigns a
 * position breaks the round-trip invariant. The rule is documented here rather
 * than enforced by the types, so nothing stops such a write at compile time.
 */
export type TreeNode = TextNode | MarkNode

export interface TextNode {
	readonly kind: 'text'
	readonly id: Id
	readonly text: Signal<string>
	position: {start: number; end: number}
	/**
	 * The derived positional read. NOT reactive: `position` is a plain field written by
	 * adoption, so a consumer that must react to a move watches `changed` or the content
	 * signals instead. Returns a COPY — the stored record is adoption's, and handing it out
	 * would let a caller corrupt the coordinate space every splice is computed in.
	 */
	range(): {start: number; end: number}
	/** See {@link NodeCommands}. Each rides a transaction; `false` in read-only mode or off the tree. */
	remove(): boolean
	duplicate(): boolean
	insertAfter(text: string): boolean
	mergeWith(next: TreeNode): boolean
	moveTo(index: number): boolean
}

export interface MarkNode {
	readonly kind: 'mark'
	readonly id: Id
	readonly descriptor: MarkupDescriptor
	/** The public view of the descriptor, which is not a public type. */
	readonly markup: Markup
	readonly value: Signal<string>
	readonly meta: Signal<string | undefined>
	readonly children: Signal<readonly TreeNode[]>
	/**
	 * Live slot POSITIONS, written by adoption like `position`; `slot()` is the public read
	 * of the slot's TEXT, which is why the two carry different names. Slot text is
	 * deliberately NOT stored: projection, snapshot and adoption equality all derive it from
	 * children, so a stored copy would be an unread mirror nothing resyncs.
	 */
	slotRange: {start: number; end: number} | undefined
	position: {start: number; end: number}
	/** The slot's TEXT, joined from the live children. `undefined` for a slotless markup. */
	slot(): string | undefined
	/** See {@link TextNode.range}. */
	range(): {start: number; end: number}
	/** Rides a transaction; `false` in read-only mode or off the tree. */
	update(patch: MarkPatch): boolean
	/** See {@link NodeCommands}. */
	remove(): boolean
	duplicate(): boolean
	insertAfter(text: string): boolean
	mergeWith(next: TreeNode): boolean
	moveTo(index: number): boolean
}

/**
 * The mark patch. Three states per optional field, expressed without a discriminator:
 * absent/`undefined` leaves the field alone, `null` clears it, a string sets it.
 */
export type MarkPatch = {
	readonly value?: string
	readonly meta?: string | null
	readonly slot?: string | null
}

/**
 * STRUCTURAL verbs, on any node. The split from {@link MarkCommands} is by the nature of
 * the operation rather than by node type: structure is common to every node, while
 * `value`/`meta`/`slot` are mark-only by definition. A block row can be a text node — the
 * empty-text filter only drops EMPTY ones — so a mark-only `remove` could not serve one.
 */
export interface NodeCommands {
	remove(node: TreeNode): boolean
	/** A verbatim copy of the node's own projection, spliced in directly after it. */
	duplicate(node: TreeNode): boolean
	/** Raw markup spliced in at the node's trailing edge — the caller owns serialization. */
	insertAfter(node: TreeNode, text: string): boolean
	/**
	 * Drop the boundary holding `node` and the sibling after it apart; `false` when there is
	 * none — which is EVERY text node, since only a slot-leading mark carries a trailing
	 * literal to remove. That answer is load-bearing rather than a degenerate case:
	 * `keyboard/blockEdit.ts` asks the verb instead of asking a predicate first, and falls
	 * through to focusing the neighbour when it declines.
	 */
	mergeWith(node: TreeNode, next: TreeNode): boolean
	/** Move a ROOT to another root index, keeping its identity. `false` for a non-root, a no-op or an out-of-range index. */
	moveTo(node: TreeNode, index: number): boolean
}

/**
 * CONTENT verbs, mark-only.
 *
 * The write ports the node's own verbs ride. Declared here rather than beside
 * the verbs in `transactions.ts` because `types.ts` is where the tree layer's
 * contracts live and both modules already import it. Injected as a THUNK because
 * `TokenModel` builds `#tree` before `#tx`, and the tree's own verbs must reach them.
 */
export interface MarkCommands {
	update(node: MarkNode, patch: MarkPatch): boolean
}

/** The whole port bag a wired tree receives. */
export type TreeCommands = NodeCommands & MarkCommands

/** The addressing model. Mark interiors are addressed via slot text nodes. */
export type NodeAnchor = {node: TextNode; offset: number} | {before: TreeNode} | {after: TreeNode} | 'start' | 'end'

/**
 * A selection's two ends in tree space: `anchor` is the fixed end, `head` the one that
 * moves. Declared here rather than beside the state that stores it, for {@link MarkCommands}'s
 * reason — `types.ts` is where the tree layer's contracts live, and
 * {@link TransactionResult} speaks it, so `selection.ts` would otherwise be imported BY the
 * file it already imports.
 */
export type Anchors = {anchor: NodeAnchor; head: NodeAnchor}

/**
 * What adoption reports back: the one field production reads. The change feed
 * (`structural`/`render`/`added`/`removed`/`updated`/`map`) was deleted with zero runtime
 * readers; the identity oracles in the specs diff the tree directly instead.
 */
export interface TransactionResult {
	/**
	 * Where the pre-adoption selection LANDS after this adoption, or `undefined` when there
	 * was none. THE selection channel — the capture itself is `adopt`'s `selectionBefore`
	 * parameter and is deliberately not echoed back out: it has no reader, and a result that
	 * carries its own input is a mirror nothing resyncs.
	 *
	 * Resolved here because a consumer cannot resolve it itself: it would have to turn the
	 * captured anchors into an offset to shift through the window arithmetic, and by the
	 * time it holds the result the stored positions have already moved — so that offset
	 * would describe the NEW coordinate space and be shifted a SECOND time. Adoption is the
	 * only code on the pre-mutation side of that line.
	 *
	 * The capture reaches `adopt` from `createBoundary`'s `fold` — the single funnel every
	 * adoption on the live path runs through (commit, arrival, reparse). NOT from the
	 * dispatcher: in controlled mode `commit` produces no result at all (it emits and
	 * waits), so the repair input is the selection captured at the ECHO's arrival, an entry
	 * the dispatcher never sees. Capturing at the
	 * boundary also spares `CommitSink.commit` a third parameter that one of its two
	 * implementations would have to ignore.
	 */
	selectionAfter: Anchors | undefined
}

/** Transactions produce {next, window}; commit policy lives in the sink. */
export interface CommitSink {
	/**
	 * Called with the tree UNMUTATED and `next` computed from its CURRENT projection, so a
	 * sink may rely on the tree still holding the pre-edit base here; adoption, inside the
	 * sink, is what ends that.
	 */
	commit(next: string, window: Window): boolean
}