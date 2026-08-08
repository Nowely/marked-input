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
	/** `content` mirrors the parsed slot text, synced by adoption — snapshots and equality only, never the projection. */
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

/** Spec D9: the single change feed adoption emits. */
export interface TransactionResult {
	structural: boolean
	/** structural OR updated contains a MarkNode — compat snapshot renderer routes on this. */
	render: boolean
	added: readonly TreeChange[]
	removed: readonly Id[]
	updated: readonly TreeNode[]
	shifted: readonly TreeNode[]
	selectionBefore: {readonly start: number; readonly end: number} | undefined
	/** Valid for PRE-adoption offsets only (spec D7). */
	map(offset: number): NodeAnchor
}

/** Spec D5: transactions produce {next, window}; commit policy lives in the sink. */
export interface CommitSink {
	commit(next: string, window: Window): boolean
}