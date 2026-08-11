import type {Signal} from '../../../shared/signals'
import type {MarkupDescriptor} from '../parser/core/MarkupDescriptor'
import type {Markup} from '../parser/types'

/** Node identity: assigned at node birth, never reused within an input instance. */
export type Id = number

/** Replaced range in the PREVIOUS projection plus inserted length. */
export type Window = {readonly start: number; readonly end: number; readonly insertedLength: number}

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
	remove(): boolean
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
 * The write port `MarkNode.update`/`remove` ride. Declared here rather than beside
 * the verbs in `transactions.ts` because `types.ts` is where the tree layer's
 * contracts live and both modules already import it. Injected as a THUNK because
 * `TokenModel` builds `#tree` before `#tx`, and the tree's own verbs must reach them.
 */
export interface MarkCommands {
	update(node: MarkNode, patch: MarkPatch): boolean
	remove(node: MarkNode): boolean
}

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

/** One change entry: `path` indexes the tree AFTER adoption. */
export interface TreeChange {
	readonly node: TreeNode
	readonly path: readonly number[]
}

/**
 * The single change feed adoption emits.
 *
 * Granularity splits by payload type and is normative: the id-only feed is
 * FLATTENED, the node feeds carry subtree ROOTS only (the node hands you the
 * subtree; an id cannot). A consumer refreshing per-node state from `added` must
 * therefore walk children itself.
 */
export interface TransactionResult {
	/**
	 * Node ADD or REMOVE only — a pure move must NOT set it: moves are plain position-field
	 * writes, and the consumers this flag routes — the view pipeline included — would
	 * repaint for a scroll of offsets that changes nothing they render.
	 */
	structural: boolean
	/** structural OR updated contains a MarkNode — compat snapshot renderer routes on this. */
	render: boolean
	/** Subtree roots: the children of a fresh mark are not listed separately. */
	added: readonly TreeChange[]
	/** Subtree-inclusive: a removed mark contributes every descendant id too. */
	removed: readonly Id[]
	updated: readonly TreeNode[]
	/**
	 * Where the pre-adoption selection LANDS after this adoption, or `undefined` when there
	 * was none. THE selection channel — the capture itself is `adopt`'s `selectionBefore`
	 * parameter and is deliberately not echoed back out: it has no reader, and a result that
	 * carries its own input is a mirror nothing resyncs.
	 *
	 * Resolved here because a consumer cannot resolve it itself: it would have to turn the
	 * captured anchors into an offset to feed {@link map}, and by the time it holds the
	 * result the stored positions have already moved — so that offset would describe the
	 * NEW coordinate space and `map` would shift it a SECOND time. Adoption is the only
	 * code on the pre-mutation side of that line.
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
	/** Valid for PRE-adoption offsets only. */
	map(offset: number): NodeAnchor
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