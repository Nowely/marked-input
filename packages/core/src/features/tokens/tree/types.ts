import type {Signal} from '../../../shared/signals'
import type {MarkupDescriptor} from '../parser/core/MarkupDescriptor'

/** Node identity: assigned at node birth, never reused within an input instance. */
export type Id = number

/** Replaced range in the PREVIOUS projection plus inserted length (spec D2). */
export type Window = {start: number; end: number; insertedLength: number}

export type TreeNode = TextNode | MarkNode

/**
 * One structure (spec D11): the same objects flow through adoption and out of
 * the public reads. Signal fields are the reactive read; adoption is the only
 * supported writer — direct setter calls from consumers are unsupported and
 * break the round-trip invariant (documented, not runtime-policed).
 * `position`/`slot` are plain fields written only by adoption (spec D3).
 */
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
	readonly children: Signal<TreeNode[]>
	slot: {content: string; start: number; end: number} | undefined
	position: {start: number; end: number}
}

/** Spec §2.3 addressing model. Mark interiors are addressed via slot text nodes. */
export type NodeAnchor = {node: TextNode; offset: number} | {before: TreeNode} | {after: TreeNode} | 'start' | 'end'

/** Spec D9: the single change feed adoption emits. */
export interface TransactionResult {
	structural: boolean
	/** structural OR updated contains a MarkNode — compat snapshot renderer routes on this. */
	render: boolean
	added: {node: TreeNode; path: number[]}[]
	removed: Id[]
	updated: TreeNode[]
	shifted: TreeNode[]
	selectionBefore: {start: number; end: number} | undefined
	/** Valid for PRE-adoption offsets only (spec D7). */
	map(offset: number): NodeAnchor
}

/** Spec D5: transactions produce {next, window}; commit policy lives in the sink. */
export interface CommitSink {
	commit(next: string, window: Window): boolean
}