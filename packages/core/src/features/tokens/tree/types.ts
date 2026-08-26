import type {Signal} from '../../../shared/signals'
import type {CoreOption} from '../../../shared/types'
import type {MarkupDescriptor} from '../parser/core/MarkupDescriptor'
import type {Markup} from '../parser/types'

/** Node identity: assigned at node birth, never reused within an input instance. */
export type Id = number

/**
 * An identity claim the string cannot carry: `pairing[j]` is the index of the PREVIOUS root
 * that becomes new root `j`. ROOT level, and ONE space on both ends: nothing sits between the
 * parse and the tree, so a root index is the parse's top-level index — where the document has rows, the
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
 * ONE EDIT THAT LANDED: the two projections it moved between, the splice that did it, and the
 * selection it was made from. What an undo stack is built out of.
 *
 * It is captured at `CommitSink.commit` — the one place BOTH modes pass through holding the
 * pre-image, since a controlled commit never reaches the fold — and emitted only once the tree
 * actually holds `next`. In controlled mode that is the echo's arrival, so a parent that refuses
 * the emission produces no record at all rather than one naming a value the document never took.
 *
 * `window` is what a replay cannot re-derive: a move past a byte-identical row is invisible to
 * any diff of the two strings, so an undo that re-derived its own window would re-pair the rows
 * by index and hand every consumer's row state to the wrong row (measured).
 *
 * EVERY MEMBER IS A VALUE, `selectionBefore` included, and that is the difference between a
 * record and a snapshot of tree state: a record outlives arbitrarily many adoptions, and an
 * {@link Anchors} held that long names nodes the tree has since replaced — an undo would restore
 * the right string with a caret no DOM can place (measured: an undone row merge left both ends
 * naming a node with no handle). Offsets live in `base`, which is exactly the projection a
 * replay restores before resolving them.
 */
export type EditRecord = {
	readonly base: string
	readonly next: string
	readonly window: Window
	readonly selectionBefore: Offsets | undefined
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
 * A first-class row (issue 08): the only root kind a document with rows has, carved by the row scanner
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
	 * Re-indent this row to `depth`, rewriting its whole lead AND ITS SUBTREE'S — the descendants
	 * travel with it, re-led by the same depth delta, because nesting is indentation and nothing
	 * else and a child left at its old lead is measured against a parent that moved.
	 *
	 * `false` for a no-op, for an editor with nesting off, and for a re-indent the SCAN would read
	 * back as a different tree: a depth deeper than the row before it grants, a blank row outdented
	 * to a root — which EMPTIES it, and an empty row takes no children — and a row after the subtree
	 * that a raised ceiling would re-parent. The rows AFTER the subtree are not otherwise protected:
	 * outdenting a row leaves the siblings following it at a depth its new depth now grants, so they
	 * become its children, which is the encoding's answer rather than a choice.
	 *
	 * It NORMALIZES a surplus indent run — see {@link lead}: the bytes a paste preserved are lost
	 * the first time a row or its ancestor is re-indented, which is the price of depth having one
	 * reading.
	 */
	setDepth(depth: number): boolean
	/**
	 * Retype this row: its kind becomes the one `option` declares, or a paragraph for `undefined`.
	 * The splice is the row's own LINE, so its id, its element and its child rows are untouched —
	 * which is what a row HAVING a kind rather than being one buys (ADR-0007).
	 *
	 * `patch.text` REPLACES the body, and it exists so a caller can strip a span and retype in ONE
	 * splice: the slash menu removes its own trigger and applies the kind in a single commit,
	 * which two verbs could not do without an intermediate state the parse would see.
	 *
	 * `false` for an option this editor compiles no row kind from — a mark option, one whose
	 * markup was reported and dropped, or one that is not in `options` at all — and for a no-op.
	 *
	 * REPARSE DECIDES what comes back, as it does for a merge: a body carrying the separator
	 * becomes two rows, and a body whose own start matches a longer opener types as THAT kind.
	 * ONE consequence is worth naming, because it is the one case where the child rows are NOT
	 * untouched: retyping a row at depth 0 whose body is empty leaves an empty LINE, and an empty
	 * row takes no children, so the scan promotes them to roots. The encoding cannot express an
	 * empty parent; the surplus indent survives verbatim in each child's `lead`.
	 */
	turnInto(option: CoreOption | undefined, patch?: RowPatch): boolean
	/**
	 * Write `rows` into this row's body at `span`, opening one row per piece past the first: the
	 * body before the span keeps `rows[0]`, the body after it follows `rows.at(-1)` in the last row
	 * this opens, and every piece between them becomes a row of its own. {@link splitAt} is the
	 * degenerate case — one cut and nothing written at it — and this is what a multi-line PASTE
	 * lands through, so a clip's lines take the row rules rather than a second copy of them.
	 *
	 * `false` for fewer than two pieces, for an editor with no separator, and for a span that is
	 * not inside this row's own body — which is what leaves a paste ACROSS rows to the ordinary
	 * replacement.
	 */
	writeRows(span: Anchors, rows: readonly string[]): boolean
	/**
	 * Split this row at `at`: the body before the anchor stays, the body after it becomes a new row
	 * at the same lead, whose kind is this one when the kind `continues` and a plain row otherwise.
	 * A continuing kind carries its `meta` into the tail with it, so splitting a checked to-do
	 * gives two checked to-dos.
	 *
	 * The tail lands after this row's whole SUBTREE, not after its line, and that is forced rather
	 * than chosen: nesting is indentation and nothing else, so a row written directly under this
	 * one at this one's lead would adopt every child it has. Placing it past the subtree is the
	 * only reading under which a split never re-parents a row it was not asked about. The one
	 * exception is the head that EMPTIES — an empty row takes no children — where the subtree
	 * follows the tail instead, which is Enter at a row's start.
	 *
	 * `false` for a non-row, for an editor with no separator to split at, and for an anchor outside
	 * this row's own body — a caret in another row cannot address this one's split point.
	 */
	splitAt(at: NodeAnchor): boolean
	/**
	 * Open a BLANK row after this row's whole subtree, at this row's own DEPTH — "add below", as a
	 * verb rather than as a separator a caller splices.
	 *
	 * The lead is the whole of what it carries, and it cannot be written outside this layer: which
	 * side of the separator it goes on depends on whether this row's subtree ENDS THE DOCUMENT —
	 * an ordinary row's span is already past its own separator, while the document-final row must
	 * be terminated before the new line can follow it. `insertAfter(separator)` carried neither,
	 * so a row added under a nested one landed at depth 0 and cut the list in two.
	 *
	 * PAST THE SUBTREE, which is {@link splitAt}'s placement rule and forced by the same encoding:
	 * a row written between this one and its children, at this one's lead, adopts every one of
	 * them. The KIND is deliberately not carried — "add a row" opens a blank one, and whether a
	 * kind continues is Enter's question.
	 *
	 * `false` for an editor with no separator, for a dead row, and for a CARVED PIECE — a cell is a
	 * Row and {@link rows} on a carved row hands a consumer exactly these, but it has no line of its
	 * own to open one beside, so the bytes would land inside the line it is a piece of.
	 */
	addSibling(): boolean
	/** See {@link NodeCommands}. */
	remove(): boolean
	duplicate(): boolean
	insertAfter(text: string): boolean
	mergeWith(next: TreeNode): boolean
	/**
	 * Move this row AND ITS SUBTREE to `placement`, keeping every row's identity — the moved
	 * subtree's, its old siblings' and its new siblings'. The subtree is re-indented to sit under
	 * its new parent, which NORMALIZES a surplus indent run exactly as {@link setDepth} does.
	 *
	 * `false` for a placement inside the moved row's OWN subtree — a row cannot become its own
	 * descendant — and for a dead row on either end, an index outside the destination's child
	 * list, a no-op, an editor with no separator to rejoin rows by, and a nested placement in an
	 * editor with nesting off.
	 *
	 * And `false` for a placement the ENCODING cannot express, which is one answer with three
	 * faces: nothing can be placed under an EMPTY row, a row carrying children cannot be re-led
	 * into an empty one — a blank row is non-empty only while it carries an indent — and a move
	 * cannot change where a row it never touched parses. The last is reachable only past a row
	 * whose lead carries a surplus indent run some earlier paste left on it, and the move is
	 * refused rather than allowed to rewrite that row.
	 */
	moveTo(placement: RowPlacement): boolean
}

/**
 * WHERE a row goes: the row it becomes a child of (`null` for the document's own root list) and
 * the index it takes among that parent's child rows AFTER the move, counted with the moved row
 * itself taken out. So `parent.rows()[index] === row` is the postcondition, and `index ===
 * rows().length` appends.
 *
 * A parent NODE rather than a depth, because depth alone cannot say which of two same-depth
 * parents a row joins, and the tree carries no parent pointers to disambiguate it afterwards.
 */
export type RowPlacement = {parent: RowNode | null; index: number}

/**
 * The row an anchor sits in, with the five facts about it that only the tree can answer. Every
 * row keybinding asks this one question and then calls a verb; the alternative is the keyboard
 * layer walking the tree, measuring a lead and re-deriving the scan's own rules.
 */
export type AnchoredRow = {
	/** The row whose LINE the anchor is on — never a carved piece; see {@link rowOf}. */
	row: RowNode
	/** The recursion index — the tree's own reading of depth, and the only one. */
	depth: number
	/**
	 * The depth a row written DIRECTLY UNDER this one lands at: one deeper, unless this row's
	 * whole line is empty, because an empty row takes no children (`RowScanner.depthCeiling`).
	 */
	childDepth: number
	/**
	 * Is the anchor this row's ENTRY — the first position a caret may occupy in it, which for a
	 * typed row is past its opener rather than at its line start.
	 */
	atEntry: boolean
	/**
	 * The row this one is nested in, `undefined` at depth 0. Free from the walk that found the
	 * row — the tree carries no parent pointers, so a caller wanting it would repeat that walk.
	 * A row with no kind takes its parent's row DECLARATION, which is what makes a soft break's
	 * second line part of the item it was typed in rather than a Tab that leaves the field.
	 */
	parent: RowNode | undefined
	/**
	 * The CARVED PIECE the anchor is in — a table cell — or `undefined` when {@link row}'s body is
	 * not carved. It is what Tab walks: a piece is a Row of `row.rows()`, so the neighbour a Tab
	 * moves to is that list's next entry and no setting declares it.
	 */
	cell: RowNode | undefined
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
}

/**
 * The row patch: the two fields a retype may carry beside the kind. `meta` has the same three
 * states {@link MarkPatch} spells — absent leaves it, `null` clears it, a string sets it — and
 * `text` replaces the row's body, which is what makes a strip-and-retype one splice.
 */
export type RowPatch = {
	readonly meta?: string | null
	readonly text?: string
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
	 * PUBLISHED API with no in-repo caller since the row keyboard began resolving a row
	 * merge through anchors (`beforeInput.ts`'s `anchorsForDelete` expands onto the boundary
	 * and the shared delete arm removes it). Kept for that contract — the `api.focus()`
	 * precedent — and because it is the one verb that answers whether the pair HAD a boundary.
	 */
	mergeWith(node: TreeNode, next: TreeNode): boolean
	/**
	 * Move ROWS and their subtrees in ONE splice, keeping every row's identity. A single row is
	 * the degenerate case — {@link RowNode.moveTo} passes itself alone. See {@link RowNode.moveTo}.
	 */
	moveTo(nodes: readonly TreeNode[], placement: RowPlacement): boolean
	/** Re-indent a ROW, keeping every row's identity. See {@link RowNode.setDepth}. */
	setDepth(node: RowNode, depth: number): boolean
	/** Retype a ROW, keeping its identity. See {@link RowNode.turnInto}. */
	turnInto(node: RowNode, option: CoreOption | undefined, patch?: RowPatch): boolean
	/** Split a ROW at an anchor in its own body. See {@link RowNode.splitAt}. */
	splitAt(node: RowNode, at: NodeAnchor): boolean
	/** Open rows inside a ROW's own body. See {@link RowNode.writeRows}. */
	writeRows(node: RowNode, span: Anchors, rows: readonly string[]): boolean
	/** Open a blank ROW after this one's subtree, at its depth. See {@link RowNode.addSibling}. */
	addSibling(node: RowNode): boolean
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
 * The same two ends as PROJECTION OFFSETS. What {@link Anchors} is not: a value, true of a
 * named string rather than of whichever nodes the tree holds right now. The one carrier that
 * needs it is {@link EditRecord}, which is kept across later adoptions — see the note there.
 */
export type Offsets = {readonly anchor: number; readonly head: number}

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