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
	 * `start`/`end` are live slot positions, written by adoption like `position`.
	 * `content` is a parse-time copy that nothing resyncs and no tree code reads as
	 * truth: projection, snapshot and adoption equality all derive slot text from
	 * children.
	 */
	slot: {content: string; start: number; end: number} | undefined
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
 * Spec D9: the single change feed adoption emits.
 *
 * Granularity splits by payload type and is normative: the id-only feed is
 * FLATTENED, the node feeds carry subtree ROOTS only (the node hands you the
 * subtree; an id cannot). A consumer refreshing per-node state from `shifted` or
 * `added` must therefore walk children itself.
 */
export interface TransactionResult {
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
	selectionBefore: {readonly start: number; readonly end: number} | undefined
	/** Valid for PRE-adoption offsets only (spec D7). */
	map(offset: number): NodeAnchor
}

/** Spec D5: transactions produce {next, window}; commit policy lives in the sink. */
export interface CommitSink {
	commit(next: string, window: Window): boolean
}