import type {Signal} from '../../../shared/signals'
import type {MarkupDescriptor} from '../parser/core/MarkupDescriptor'
import type {Markup} from '../parser/types'

/** Node identity: assigned at node birth, never reused within an input instance. */
export type Id = number

/**
 * An identity claim the string cannot carry: `pairing[j]` is the index of the PREVIOUS root
 * that becomes new root `j`. ROOT level, and ONE space on both ends: nothing sits between the
 * parse and the tree, so a root index is the parse's top-level index — in block layout, the
 * row index a drag names (ADR-0009).
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
export type TreeNode = TextNode | MarkNode | RowNode

/**
 * A first-class block row (issue 08): block layout's only root kind, carved by the row scanner
 * from the structural separator and TYPED by its own opener (ADR-0010). Never a child of a mark
 * or another row. A paragraph is a Row with no kind at all — its children are the plain text and
 * inline marks of the whole line.
 */
export interface RowNode {
	readonly kind: 'row'
	readonly id: Id
	/**
	 * THE row's kind: the compiled markup its opener matched, `undefined` for a paragraph.
	 *
	 * A SIGNAL, unlike {@link MarkNode.descriptor}, and that difference is the design: a mark IS
	 * its markup, so adopting across descriptors would leave a node disagreeing with the parse; a
	 * row HAS a kind, and a turn-into must keep the row's identity — its id, its element, its
	 * drag grip — while the kind changes underneath it.
	 */
	readonly descriptor: Signal<MarkupDescriptor | undefined>
	/** The kind's metadata gap — a todo's checked flag, a fence's language. */
	readonly meta: Signal<string | undefined>
	/**
	 * INLINE children first, then CHILD ROWS. ONE list, so every generic walk in `tree/`, `bind`
	 * and `transactions` stays untouched by nesting; {@link inline} and {@link rows} are the two
	 * named halves the caret mapping and the renderer need.
	 */
	readonly children: Signal<readonly TreeNode[]>
	/** The row's own inline content — Text and Mark nodes only, at least one text child. */
	inline(): readonly TreeNode[]
	/** The rows nested under this one. */
	rows(): readonly RowNode[]
	/**
	 * The public view of the kind: the index of the option that declared it, which is the same
	 * identity `resolveSlot` already resolves a mark's component by. `undefined` for a paragraph.
	 * Derived from {@link descriptor}, so the two cannot disagree.
	 */
	option(): number | undefined
	/**
	 * Structural bytes BEFORE the body: the indent run this row is nested by. It is the ROUND-TRIP
	 * BYTES and depth is the TREE, and there is no function from one to the other — an
	 * over-indented paste keeps its surplus here while the clamp renders it shallower.
	 *
	 * A SIGNAL rather than a plain field beside {@link position}, and the difference is not
	 * cosmetic: the projection EMITS the lead, so a re-indent that leaves every child object in
	 * place would otherwise change no signal at all and `value` would keep answering the string
	 * from before the Tab.
	 */
	readonly lead: Signal<string>
	/**
	 * INCLUDES the trailing separator on every row but the document-final one, and the row's
	 * whole SUBTREE. See {@link lineRange} for the row's own line alone.
	 */
	position: {start: number; end: number}
	/**
	 * The row's own LINE — its lead, its body and its own separator, the nested subtree
	 * excluded. Derived, because a row's line ends exactly where its first child row begins.
	 */
	lineRange(): {start: number; end: number}
	/**
	 * The row's own editable interior — everything its opener and closing literal enclose.
	 * DERIVED from the INLINE children's outer edges, which is exactly what the parse put there.
	 */
	slotRange(): {start: number; end: number}
	/** The interior's TEXT, joined from the live inline children. */
	slot(): string
	/** See {@link TextNode.range}. */
	range(): {start: number; end: number}
	/**
	 * Re-indent this row to `depth`, rewriting its whole lead. `false` for a depth deeper than
	 * one past the row before it, for a no-op, and for an editor with nesting off.
	 *
	 * It NORMALIZES a surplus indent run — see {@link lead}: the bytes a paste preserved are lost
	 * the first time a row is re-indented, which is the price of depth having one reading.
	 */
	setDepth(depth: number): boolean
	/** See {@link NodeCommands}. */
	remove(): boolean
	duplicate(): boolean
	insertAfter(text: string): boolean
	mergeWith(next: TreeNode): boolean
	moveTo(index: number): boolean
}

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
 * `value`/`meta`/`slot` are mark-only by definition.
 */
export interface NodeCommands {
	remove(node: TreeNode): boolean
	/** A verbatim copy of the node's own projection, spliced in directly after it. */
	duplicate(node: TreeNode): boolean
	/** Raw markup spliced in at the node's trailing edge — the caller owns serialization. */
	insertAfter(node: TreeNode, text: string): boolean
	/**
	 * Drop the boundary holding `node` and the row after it in PRE-ORDER apart — the separator,
	 * that row's lead and its opener, so the survivor keeps `node`'s own kind. `false` when there
	 * is no boundary: a non-row on either side, no configured separator, or a pair that is not
	 * actually adjacent.
	 *
	 * PUBLISHED API with no in-repo caller since the block keyboard began resolving a row
	 * merge through anchors (`beforeInput.ts`'s `anchorsForDelete` expands onto the boundary
	 * and the shared delete arm removes it). Kept for that contract — the `api.focus()`
	 * precedent — and because it is the one verb that answers whether the pair HAD a boundary.
	 */
	mergeWith(node: TreeNode, next: TreeNode): boolean
	/** Move a ROOT to another root index, keeping its identity. `false` for a non-root, a no-op or an out-of-range index. */
	moveTo(node: TreeNode, index: number): boolean
	/** Re-indent a ROW, keeping every row's identity. See {@link RowNode.setDepth}. */
	setDepth(node: TreeNode, depth: number): boolean
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