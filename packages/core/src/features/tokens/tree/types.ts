import type {Signal} from '../../../shared/signals'
import type {MarkupDescriptor} from '../parser/core/MarkupDescriptor'

/** Node identity: assigned at node birth, never reused within an input instance. */
export type Id = number

/** Replaced range in the PREVIOUS projection plus inserted length (spec D2). */
export type Window = {readonly start: number; readonly end: number; readonly insertedLength: number}

/**
 * One structure (spec D11): the same objects flow through adoption and out of
 * the public reads. Signal fields are the reactive read; adoption is the only
 * supported writer — direct setter calls from consumers are unsupported and
 * break the round-trip invariant (documented, not runtime-policed).
 * `position`/`slot` are plain fields written only by adoption (spec D3).
 */
export type TreeNode = TextNode | MarkNode

export interface TextNode {
	readonly kind: 'text'
	readonly id: Id
	readonly text: Signal<string>
	position: {start: number; end: number}
}

export interface MarkNode {
	readonly kind: 'mark'
	readonly id: Id
	readonly descriptor: MarkupDescriptor
	readonly value: Signal<string>
	readonly meta: Signal<string | undefined>
	readonly children: Signal<readonly TreeNode[]>
	/**
	 * Live slot positions, written by adoption like `position`. Slot TEXT is deliberately
	 * NOT stored: projection, snapshot and adoption equality all derive it from children,
	 * so a stored copy would be an unread mirror nothing resyncs.
	 */
	slot: {start: number; end: number} | undefined
	position: {start: number; end: number}
}

/** Spec §2.3 addressing model. Mark interiors are addressed via slot text nodes. */
export type NodeAnchor = {node: TextNode; offset: number} | {before: TreeNode} | {after: TreeNode} | 'start' | 'end'

/** One change entry: `path` indexes the tree AFTER adoption. */
export interface TreeChange {
	readonly node: TreeNode
	readonly path: readonly number[]
}

/**
 * A selection range in projection coordinates. Structurally identical to
 * `shared/editorContracts`'s `Range` and deliberately re-declared on LAYERING
 * grounds: `tree/` is the core and must not reach up into the editor contracts
 * for a two-number record.
 */
export type SelectionRange = {readonly start: number; readonly end: number}

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
	 * there was none. `map(offset)` is defined only for offsets in this coordinate
	 * space.
	 *
	 * Captured by `createBoundary`'s `fold` — the single funnel every adoption on the
	 * live path runs through (commit, arrival, reparse) — because adoption mutates
	 * stored positions in place and deriving the range afterwards double-shifts it.
	 *
	 * NOT captured by the dispatcher, which an earlier note here proposed: in
	 * controlled mode `commit` produces no result at all (it emits and waits), so the
	 * repair input is the range captured at the ECHO's arrival, an entry the
	 * dispatcher never sees. Capturing at the boundary also spares `CommitSink.commit`
	 * a third parameter that one of its two implementations would have to ignore.
	 * Consumed by `SelectionController` at S1.6c.
	 */
	selectionBefore: SelectionRange | undefined
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