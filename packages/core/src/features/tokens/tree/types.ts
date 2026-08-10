import type {Signal} from '../../../shared/signals'
import type {MarkupDescriptor} from '../parser/core/MarkupDescriptor'
import type {Markup} from '../parser/types'

/** Node identity: assigned at node birth, never reused within an input instance. */
export type Id = number

/** Replaced range in the PREVIOUS projection plus inserted length (spec D2). */
export type Window = {readonly start: number; readonly end: number; readonly insertedLength: number}

/**
 * One structure (spec D11): the same objects flow through adoption and out of
 * the public reads. Signal fields are the reactive read; adoption is the only
 * supported writer — direct setter calls from consumers are unsupported and
 * break the round-trip invariant (documented, not runtime-policed).
 * `position`/`slotRange` are plain fields written only by adoption (spec D3).
 */
export type TreeNode = TextNode | MarkNode

export interface TextNode {
	readonly kind: 'text'
	readonly id: Id
	readonly text: Signal<string>
	position: {start: number; end: number}
	/**
	 * Spec §2.3's explicit derived read. NOT reactive: `position` is a plain field written
	 * by adoption (spec D3), so a consumer that must react to a move watches `changed` or
	 * the content signals instead. Returns a COPY — the stored record is adoption's, and
	 * handing it out would let a caller corrupt the coordinate space every splice is
	 * computed in.
	 */
	range(): {start: number; end: number}
}

export interface MarkNode {
	readonly kind: 'mark'
	readonly id: Id
	readonly descriptor: MarkupDescriptor
	/** Spec §2.3: the public view of the descriptor, which is not a public type. */
	readonly markup: Markup
	readonly value: Signal<string>
	readonly meta: Signal<string | undefined>
	readonly children: Signal<readonly TreeNode[]>
	/**
	 * Live slot POSITIONS, written by adoption like `position`. Named `slotRange` since
	 * S1.7, because `slot()` is now the public read of the slot's TEXT (spec §2.3) and one
	 * name cannot be both. Slot text is still deliberately NOT stored: projection, snapshot
	 * and adoption equality all derive it from children, so a stored copy would be an unread
	 * mirror nothing resyncs.
	 */
	slotRange: {start: number; end: number} | undefined
	position: {start: number; end: number}
	/** Spec §2.3: the slot's TEXT, joined from the live children. `undefined` for a slotless markup. */
	slot(): string | undefined
	/** Spec §2.3. See {@link TextNode.range}. */
	range(): {start: number; end: number}
	/** Spec §2.3. Rides a transaction (spec D5); `false` in read-only mode or off the tree. */
	update(patch: MarkPatch): boolean
	remove(): boolean
}

/**
 * Spec §2.3's mark patch. Three states per optional field, expressed without a
 * discriminator (plan decision D-b): absent/`undefined` leaves the field alone, `null`
 * clears it, a string sets it. Replaces the `{kind:'set'|'clear'}` `OptionalMarkFieldPatch`
 * of the pre-v2 surface — a documented break.
 */
export type MarkPatch = {
	readonly value?: string
	readonly meta?: string | null
	readonly slot?: string | null
}

/**
 * The write port `MarkNode.update`/`remove` ride (spec D5). Declared here rather than
 * beside the verbs in `transactions.ts` because `types.ts` is where the tree layer's
 * contracts live and both modules already import it. Injected as a THUNK: `TokenModel`
 * builds `#tree` before `#tx`, the same reason `SelectionPort` is one.
 */
export interface MarkCommands {
	update(node: MarkNode, patch: MarkPatch): boolean
	remove(node: MarkNode): boolean
}

/** Spec §2.3 addressing model. Mark interiors are addressed via slot text nodes. */
export type NodeAnchor = {node: TextNode; offset: number} | {before: TreeNode} | {after: TreeNode} | 'start' | 'end'

/**
 * A selection's two ends in tree space (spec D7): `anchor` is the fixed end, `head` the
 * one that moves. Declared here rather than beside the state that stores it, for
 * {@link MarkCommands}'s reason — `types.ts` is where the tree layer's contracts live, and
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
 * Spec D9: the single change feed adoption emits.
 *
 * Granularity splits by payload type and is normative: the id-only feed is
 * FLATTENED, the node feeds carry subtree ROOTS only (the node hands you the
 * subtree; an id cannot). A consumer refreshing per-node state from `shifted` or
 * `added` must therefore walk children itself.
 */
export interface TransactionResult {
	/**
	 * Node ADD or REMOVE only. D9's prose reads "any node add/remove/move", but a pure
	 * move must not set it: moves are plain position-field writes with their own
	 * render-inert feed (`shifted`), and the consumers this flag routes — the view
	 * pipeline included — would repaint for a scroll of offsets that changes nothing
	 * they render.
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
	 * Every node whose stored `position` moved, at subtree-root granularity: a listed node
	 * covers its descendants, which are not listed again. Suffix-walk entries moved by one
	 * delta, middle-region entries need not — re-read descendant positions rather than
	 * applying the root's.
	 */
	shifted: readonly TreeNode[]
	/**
	 * The selection as it stood BEFORE this adoption (spec D7), or `undefined` when
	 * there was none — ANCHORS, so the record carries no coordinate at all and cannot
	 * go stale when adoption moves the nodes it names.
	 *
	 * Captured by `createBoundary`'s `fold` — the single funnel every adoption on the
	 * live path runs through (commit, arrival, reparse). NOT by the dispatcher, which an
	 * earlier note here proposed: in controlled mode `commit` produces no result at all
	 * (it emits and waits), so the repair input is the selection captured at the ECHO's
	 * arrival, an entry the dispatcher never sees. Capturing at the boundary also spares
	 * `CommitSink.commit` a third parameter that one of its two implementations would
	 * have to ignore.
	 */
	selectionBefore: Anchors | undefined
	/**
	 * Where that selection LANDS after this adoption, or `undefined` when there was none.
	 *
	 * Resolved here because a consumer cannot resolve it itself: it would have to turn
	 * {@link selectionBefore} into an offset to feed {@link map}, and by the time it holds
	 * the result the stored positions have already moved — so that offset would describe
	 * the NEW coordinate space and `map` would shift it a SECOND time. Adoption is the
	 * only code on the pre-mutation side of that line.
	 */
	selectionAfter: Anchors | undefined
	/** Valid for PRE-adoption offsets only (spec D7). */
	map(offset: number): NodeAnchor
}

/** Spec D5: transactions produce {next, window}; commit policy lives in the sink. */
export interface CommitSink {
	/**
	 * Called with the tree UNMUTATED and `next` computed from its CURRENT projection, so a
	 * sink may rely on the tree still holding the pre-edit base here; adoption, inside the
	 * sink, is what ends that.
	 */
	commit(next: string, window: Window): boolean
}