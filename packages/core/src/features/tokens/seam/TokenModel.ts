import type {DomRef} from '../../../shared/editorContracts'
import {reportBadProp} from '../../../shared/reportBadProp'
import {batch, computed, event, signal, untracked, watch} from '../../../shared/signals/index.js'
import type {Computed, Event} from '../../../shared/signals/index.js'
import type {CoreOption, RowSpec} from '../../../shared/types'
import {shallow} from '../../../shared/utils/shallow'
import type {Host} from '../../state/Host'
import type {PropsModel} from '../../state/PropsModel'
import {createCommitPipeline} from '../dom/commit'
import {createControlRoots} from '../dom/controlRoots'
import type {ControlRoots} from '../dom/controlRoots'
import type {BoundaryAffinity} from '../dom/domBoundary'
import {DomModel} from '../dom/DomModel'
import {SelectionDriver} from '../dom/SelectionDriver'
import type {TokenHandle} from '../dom/TokenHandle'
import type {MarkupDescriptor} from '../parser/core/MarkupDescriptor'
import {markupError} from '../parser/core/MarkupDescriptor'
import type {RowDeclaration} from '../parser/core/RowKind'
import {rowMarkupError, rowOpener, rowSplitOf} from '../parser/core/RowKind'
import {Parser} from '../parser/Parser'
import type {Markup, RowConfig} from '../parser/types'
import {annotate} from '../parser/utils/annotate'
import {
	adjacentMark as findAdjacentMark,
	anchorAt as anchorAtOffset,
	boundarySpan as findBoundarySpan,
	entryAnchor,
	offsetOfAnchor,
	slotWithout,
	stepAnchor,
} from '../tree/anchors'
import {gapWindow} from '../tree/gapWindow'
import {preorderRows} from '../tree/rows'
import {createSelection} from '../tree/selection'
import type {Selection} from '../tree/selection'
import {
	depthPlan,
	dropPlacements,
	endsDocument,
	mergePlan,
	movePlan,
	removePlan,
	rowOf,
	rowScope,
	rowsWithin,
	splitPlan,
	turnIntoPlan,
} from '../tree/siblings'
import {createTransactions} from '../tree/transactions'
import {createTokenTree, findNode, sliceNodes} from '../tree/tree'
import type {
	AnchoredRow,
	Anchors,
	EditRecord,
	MarkNode,
	MarkPatch,
	NodeAnchor,
	RowNode,
	RowPlacement,
	TreeCommands,
	TreeNode,
	Window,
} from '../tree/types'
import {createBoundary} from '../tree/valueBoundary'
import type {ReplayLanding} from '../tree/valueBoundary'

/**
 * The value owner: it holds THE token tree, the string boundary that decides commit policy
 * and the transaction verbs that write it, and feeds each adoption result straight into the
 * one commit pipeline. Parsing belongs to the boundary and token identity to adoption.
 * Everything DOM-related — boundary math, selection reads, caret placement — lives in
 * {@link DomModel} and is delegated to here, so consumers keep this single entry point.
 * Owns the `nodes` map the pipeline mutates, and the selection: {@link selection} (its
 * tree-space state) plus the private {@link SelectionDriver} (its DOM I/O).
 *
 * Long-form design: `features/tokens/README.md`.
 *
 * Layout: consumer reads → adapter SPI → engine SPI → wiring → internals.
 */
export class TokenModel {
	// ═══ Consumer reads ═══════════════════════════════════════════════════════

	/**
	 * THE model clock: one pulse per commit, once the tree, the projection and the repaired
	 * selection are all in place. It fires for commits that move NO element — a row reorder and a
	 * mark value change both leave the id space and the element set untouched — which is the
	 * whole reason it is not the DOM clock.
	 *
	 * PAYLOAD-FREE, deliberately: a consumer that wants to know what changed re-reads
	 * {@link nodes} or {@link find}. The change-feed record is in the README's refuted list.
	 */
	get committed(): Event<void> {
		return this.#pipeline.committed
	}

	/**
	 * THE DOM clock: one pulse per bind, so every handle matches an element in the document. Only
	 * the caret needs it — a caret landing in a node BORN by the commit has no handle until bind
	 * makes one, so nothing earlier can place it.
	 */
	get bound(): Event<void> {
		return this.#pipeline.bound
	}

	/**
	 * THE EDIT FEED: one {@link EditRecord} per edit the document actually took, payload-carrying
	 * where {@link committed} is payload-free — a stack cannot re-read the pre-image, it has to be
	 * handed it.
	 *
	 * A {@link replay} fires NOTHING here, and that is structural rather than latched: an undo does
	 * not go through the sink that captures records, so there is no "am I replaying" state to keep
	 * (which in controlled mode would be cleared a whole echo too early anyway).
	 */
	readonly edits: Event<EditRecord> = event()

	/**
	 * Resolve a token id to its live handle, or `undefined`. THE identity lookup: a consumer
	 * holding a render-tree token resolves `handle(token.id)` for MEASUREMENT and CARET
	 * commands, and the handle's existence IS the validity check. It carries no data of its
	 * own — content and positions are read from the node ({@link find}).
	 *
	 * ABSENCE IS THE ONLY REFUSAL (ADR-0008): a node BORN by a commit has no handle until
	 * `bind` creates one, and that structural refusal is the only one this lookup needs — the
	 * pending-structural latch that also failed closed for SURVIVING nodes is refuted in the
	 * README. A caret placed mid-window is a transient the post-bind `tokens.bound` re-apply
	 * corrects in the same frame (`dom/SelectionDriver`). Gated by `seam/pendingWindow.spec.ts`.
	 */
	handle(id: number): TokenHandle | undefined {
		return this.#nodes.get(id)
	}

	/**
	 * THE selection state: a pair of `NodeAnchor`s and their derivations, DOM-free. Its DOM
	 * half is the private {@link SelectionDriver} declared in the internals section, whose
	 * reads are exposed here as {@link domAnchors} / {@link focusFirst}.
	 */
	readonly selection: Selection = createSelection({
		// A bag of CLOSURES, none of them read before the first verb call — the ONLY reason this
		// field may sit above `#tree`/`value`, whose initializers have not run yet.
		//
		// Two of the three are NOT bare tree reads and cannot become them: {@link anchorAt}
		// SEEDS (an unmaterialized tree has no roots, so every offset answers `'end'` — gates
		// `tree/selection.spec`'s "returns true when range spans the entire value"), and
		// {@link value} is props-first, so `#tree.value()` disagrees with it exactly while a
		// controlled parent's value is ahead of the last arrival.
		//
		// `offsetOf` is an anchor's absolute offset in the tree's projection — the ONE place a
		// coordinate is formed, and its readers are inside `tree/` (`Selection.isAllSelected`,
		// `anchors.ts`'s adjacency and step). Deliberately does NOT seed — it is a READ reached
		// from a computed's evaluation, and seeding writes signals.
		//
		// TREE space, not {@link value}: the two disagree exactly while a controlled parent's
		// `props.value` is ahead of the last arrival, which is when the echo's capture runs. Its
		// gate is `tree/selection.spec`'s "captures an 'end' anchor in TREE space, not against
		// the props value", and that case has to be a DELETION — under an insertion the
		// over-read and `map`'s shift both saturate onto the document end and the two readings
		// agree by accident.
		offsetOf: anchor => untracked(() => offsetOfAnchor(this.#tree.roots(), anchor)),
		anchorAt: offset => this.anchorAt(offset),
		contentStart: () =>
			untracked(() => {
				const roots = this.#tree.roots()
				return offsetOfAnchor(roots, anchorAtOffset(roots, 0))
			}),
		value: () => this.value(),
	})

	// ═══ Adapter SPI ══════════════════════════════════════════════════════════

	/**
	 * Ref callback for a control element (e.g. overlay, drag handle). Registration is
	 * ELEMENT-ONLY — nothing ever asks which token owns a control — and it goes straight into
	 * {@link ControlRoots}, which owns the membership the locate walk reads.
	 *
	 * NO BIND: a control's ancestor chain is a pure DOM walk that touches no token, so it
	 * updates in place. Routing a ref through the bind counter makes a block mount quadratic —
	 * block layout used to mount up to four controls per ROW, measured at 400 rows / 400 binds /
	 * 93 ms. It mounts ONE now, the controls layer, but a ref that costs a whole-tree walk is
	 * still the wrong shape.
	 *
	 * REGISTRATION is also where the control leaves the editing host: a control is editor UI,
	 * not document content, so inside the one contenteditable container it must be atomic
	 * or the caret and the browser's own editing walk into grips, menus and overlays. It is
	 * written HERE and not in `bind` because controls do not mount on the commit clock — a
	 * menu opening off a row-control signal never sees a re-bind, and would stay editable until
	 * some unrelated commit happened to repaint.
	 */
	control(): DomRef {
		let registered: HTMLElement | undefined
		return element => {
			if (element) {
				element.contentEditable = 'false'
				registered = element
				this.#controlRoots.add(element)
			} else if (registered) {
				this.#controlRoots.remove(registered)
				registered = undefined
			}
		}
	}

	/**
	 * Ref callback for the element hosting a token's child sequence. Keyed per REGISTRATION like
	 * {@link control}; the owner rides in the VALUE, named by stable id rather than by index, so
	 * it does not go stale when a sibling above the owner is added or removed mid-render.
	 *
	 * `part` names WHICH sequence: a row has two, its inline content and its child rows, and the
	 * caret mapping needs the split between them to be deterministic. Named parts rather than one
	 * list because registration order cannot give that.
	 */
	children(ownerId: number, part: 'inline' | 'rows' = 'inline'): DomRef {
		return this.#refInto(part === 'rows' ? this.#rowSequenceHosts : this.#childSequenceHosts, ownerId)
	}

	/**
	 * Ref callback for a token's OWN element. THE element source: `bind` and `rebind` both read
	 * this registry and nothing else — the framework held the element a moment before it painted
	 * it, so the association is pushed rather than re-discovered by a DOM walk.
	 *
	 * Keyed by owner id, then per REGISTRATION like {@link children}, so a ref that outlives a
	 * re-render cannot be filed under a stale key and one id's element is one lookup.
	 */
	consign(id: number): DomRef {
		return this.#refInto(this.#tokenElements, id)
	}

	// ═══ Engine SPI (in-core consumers) ═══════════════════════════════════════

	/**
	 * THE value read: controlled → the props value; uncontrolled → THE TREE'S OWN PROJECTION.
	 * There is no second store and no mirrored string: the tree is the value, and `#seed`
	 * answers only before it holds anything.
	 *
	 * It read a `#committed` mirror — the projection copied out after each commit — until the
	 * commit became atomic. The copy existed to make `value` the LAST thing a commit
	 * invalidated, because adoption's batch used to flush before the DOM caught up, handing a
	 * subscriber a new string over an old document. One batch around the fold makes that
	 * unrepresentable, so the derivation can name its source directly.
	 *
	 * The `#seeded` arm is load-bearing: without it, `TokenModel.value.spec`'s "an unmounted
	 * store reads defaultValue before anything has committed" reads the empty tree.
	 */
	readonly value: Computed<string> = computed(
		() => this.props.value() ?? (this.#seeded() ? this.#tree.value() : this.#seed())
	)

	/**
	 * @internal THE text write: a cross-node replacement addressed by ANCHORS. The pair is
	 * normalized, so `from` after `to` is legal.
	 *
	 * Answers the CARET the edit's natural post-state wants — an anchor at the END of what
	 * was inserted, resolved against the POST-splice tree — or `undefined` when the write was
	 * refused. That is an answer and not a side effect because only this layer may form the
	 * offset it needs (`min(from, to) + text.length`); `EditController` applies it, and
	 * nothing above `tree/` forms a number. It is the whole reason the verb does not return a
	 * bare boolean.
	 *
	 * In CONTROLLED mode the tree has NOT moved — the commit emits and waits for the echo —
	 * so the anchor describes the pre-edit tree. `EditController` discards it there and
	 * {@link setValue} reads it only as a success flag.
	 */
	replaceBetween(from: NodeAnchor, to: NodeAnchor, text: string): NodeAnchor | undefined {
		this.#ensureSeeded()
		// Lowered in the TREE's coordinate space: that is what `transactions.dispatch` splices,
		// and the space the anchors themselves resolve in. NOT {@link value}, which is props-first
		// and runs ahead of the tree while a controlled parent's arrival is still in flight.
		const op = untracked(() => {
			const roots = this.#tree.roots()
			const a = offsetOfAnchor(roots, from)
			const b = offsetOfAnchor(roots, to)
			const start = Math.min(a, b)
			const end = Math.max(a, b)
			const value = this.#tree.value()
			// WHOLE-VALUE ops are re-derived through `gapWindow`: a full window makes both
			// adoption walks inert and re-pairs every row BY INDEX, so a row's identity — and
			// with it whatever a consumer's own row component holds — lands on the wrong row.
			if (start === 0 && end === value.length) {
				const window = gapWindow(value, text)
				return {window, slice: text.slice(window.start, window.start + window.insertedLength)}
			}
			return {window: {start, end, insertedLength: text.length}, slice: text, caret: start + text.length}
		})
		if (!this.#tx.applyRange(op.window, op.slice)) return undefined
		// `caret` is absent exactly on the whole-value arm, where the narrowed window's start
		// is NOT the caller's: the caret is the end of the string it supplied.
		return this.anchorAt(op.caret ?? text.length)
	}

	/**
	 * @internal Whole-value replacement: {@link replaceBetween} over the document edges. The
	 * EDGES, not `{0, value().length}`: the whole-value arm tests `end` against the TREE's
	 * length, which {@link value} outruns mid-flight — missing it splices a foreign window.
	 * Deliberately kept: spec-facing and public-reachable through the exported Store (`store.tokens`) — the `api.focus()` precedent.
	 *
	 * It names no caret. `enterRoot` — an index into {@link rowSequence}, put here when a row edit
	 * had no node to name the caret with — had one caller, the row keymap's all-selected Enter, and
	 * that call was measured redundant: the replacement's own post-edit anchor already resolves
	 * INSIDE the fresh row, because {@link entryAnchor} is what `anchorAt` answers for an offset in
	 * a row's structural bytes.
	 */
	setValue(text: string): boolean {
		return this.replaceBetween('start', 'end', text) !== undefined
	}

	/**
	 * @internal UNDO/REDO'S WRITE: put the document back to `value` through the exact `window` the
	 * recorded edit moved it by. What the caller is owed once the document HAS it — the caret to
	 * restore, and the caller's own bookkeeping — rides in `landing`, for the reason an
	 * {@link EditRecord} does: in controlled mode this write is an emission, and the parent may
	 * decline it.
	 *
	 * NOT AN EDIT PATH, and that is the whole shape of it: it bypasses the sink that captures
	 * {@link EditRecord}s, so a replay writes no record and the stack cannot re-enter itself.
	 * `setValue` would — it commits through the ordinary sink — and it would also arrive with no
	 * `Pairing`, which re-labels every row a move had reordered (measured in `history/`'s spec).
	 *
	 * The window is not re-derivable here, so it is not derived: a caller replaying a recorded edit
	 * holds the one window whose coordinates and identity claim are both true of this document.
	 *
	 * READ-ONLY REFUSES, for the flip that a stack outlives: the entries were recorded while the
	 * editor was writable, and nothing else would stop them being replayed into one that is not.
	 *
	 * NO `#ensureSeeded`, unlike every other write here: a replay needs a recorded edit, a record
	 * needs an edit that LANDED, and landing seeds the tree — which never empties back, since even
	 * the empty document parses to one root. The guard was measured out rather than argued about.
	 */
	replay(value: string, window: Window, landing?: ReplayLanding): boolean {
		if (untracked(() => this.props.readOnly())) return false
		return this.#boundary.replay(value, window, landing)
	}

	/**
	 * The mark whose end (`-1`) or start (`+1`) coincides with `anchor`. THE adjacency test
	 * behind the Backspace/Delete mark swallow and `insertMark`'s post-splice lookup.
	 */
	adjacentMark(anchor: NodeAnchor, direction: -1 | 1): MarkNode | undefined {
		return untracked(() => findAdjacentMark(this.#tree.roots(), anchor, direction))
	}

	/** One character back (`-1`) or forward (`+1`). See {@link stepAnchor} for the fail-closed case. */
	step(anchor: NodeAnchor, direction: -1 | 1): NodeAnchor | undefined {
		return untracked(() => stepAnchor(this.#tree.roots(), anchor, direction))
	}

	/**
	 * The row boundary a collapsed delete at `anchor` removes — THE row half of the
	 * Backspace/Delete expansion, beside {@link adjacentMark}'s swallow. See
	 * {@link boundarySpan}; `undefined` for every anchor in a document that parses no rows.
	 */
	boundarySpan(anchor: NodeAnchor, direction: -1 | 1): Anchors | undefined {
		return untracked(() => findBoundarySpan(this.#tree.roots(), anchor, direction, this.#tree.config()?.separator))
	}

	/**
	 * THE ROW A CARET IS IN, and what a keybinding needs to know about it — see {@link rowOf}.
	 * `undefined` for an anchor in no row, which is every anchor in a document that parses none.
	 */
	rowOf(anchor: NodeAnchor): AnchoredRow | undefined {
		return untracked(() => rowOf(this.#tree.roots(), anchor))
	}

	/**
	 * The {@link RowSpec} a row's KIND was declared with, or `undefined` for a paragraph and for a
	 * kind whose option has since left `options`. The row's OPTION INDEX is the identity — the same
	 * one `resolveSlot` resolves the component by — so this is the one place a row's declared
	 * behavior is read, rather than each caller walking from the descriptor to the option itself.
	 */
	rowSpec(node: RowNode): RowSpec | undefined {
		return untracked(() => {
			const index = node.option()
			return index === undefined ? undefined : this.props.options()[index]?.row
		})
	}

	/**
	 * THE ROWS A SELECTION COVERS WHOLE — see {@link rowsWithin}. What `store.block.selected`
	 * derives from, and the reason there is no second store of selected rows: a row selection IS
	 * the text selection, read at row granularity.
	 */
	rowsWithin(anchors: Anchors): readonly RowNode[] {
		return untracked(() => {
			const roots = this.#tree.roots()
			const ends = [offsetOfAnchor(roots, anchors.anchor), offsetOfAnchor(roots, anchors.head)]
			const span = {start: Math.min(...ends), end: Math.max(...ends)}
			return rowsWithin(roots, span, this.#tree.config()?.separator)
		})
	}

	/**
	 * THE SPAN a row-selection gesture widens to — see {@link rowScope}. `undefined` when the
	 * gesture has nothing to widen to, which is what leaves the key to the browser.
	 */
	rowScope(anchors: Anchors, scope: 'row' | 'out' | 'up' | 'down'): {start: number; end: number} | undefined {
		return untracked(() => rowScope(this.#tree.roots(), anchors, scope, this.#tree.config()?.separator))
	}

	/**
	 * EVERY PLACEMENT A DROP INTO ONE GAP MAY TAKE — see {@link dropPlacements}. What the drag layer
	 * turns a pointer's horizontal position into, and the reason the drop indicator cannot promise
	 * a move the mover would refuse.
	 */
	dropPlacements(
		nodes: readonly RowNode[],
		row: RowNode,
		edge: 'before' | 'after'
	): readonly {depth: number; placement: RowPlacement}[] {
		return untracked(() => dropPlacements(this.#tree.roots(), nodes, row, edge, this.#tree.config()))
	}

	/**
	 * Move a SET of rows to one placement, in one splice — {@link RowNode.moveTo} widened to what
	 * a multi-row drag names. The set is normalized to maximal subtrees inside the plan, so a
	 * caller may hand over a selection verbatim.
	 *
	 * On the model rather than on a node, because the set has no owning row: `store.block.move` is
	 * its one caller and the rows it names are peers.
	 */
	moveRows(nodes: readonly RowNode[], placement: RowPlacement): boolean {
		return this.#commands.moveTo(nodes, placement)
	}

	/**
	 * A row's body once `span` is cut out of it — see {@link slotWithout}. What a caller with a
	 * span to remove hands to `turnInto`'s `text`, so the removal and the retype are one splice.
	 */
	slotWithout(row: RowNode, span: Anchors): string | undefined {
		return untracked(() => slotWithout(this.#tree.roots(), row, span))
	}

	/** The projection of the span between two anchors — {@link value} restricted to a window (see {@link sliceNodes}). */
	valueBetween(from: NodeAnchor, to: NodeAnchor): string {
		return untracked(() => sliceNodes(this.#tree.roots(), from, to, this.#tree.config()?.separator))
	}

	/** Resolve a stable id to its live node. */
	find(id: number): TreeNode | undefined {
		return untracked(() => findNode(this.#tree.roots(), id))
	}

	/**
	 * THE render read: the live root nodes. Deliberately does NOT seed — it is a read, and
	 * seeding writes signals.
	 *
	 * A `Computed` field rather than a method, which is what lets an adapter SUBSCRIBE to
	 * it: `readSelected` calls a selector entry only when `isReactive` says so, and that
	 * test is the bound signal/computed name — a plain method reads as data and would be
	 * handed to the renderer uncalled.
	 */
	readonly nodes: Computed<readonly TreeNode[]> = computed(() => this.#tree.roots())

	/**
	 * THE block parse policy: how the row skeleton is carved, or `undefined` for a document
	 * that has no rows. There is no mode beside it (ADR-0011) — every row question in core asks
	 * this, or the tree it produced.
	 *
	 * PROPS-derived, deliberately not tree-derived. `SlotsFeature.containerProps` reads it
	 * during SERVER rendering, where no container has attached and the tree is therefore still
	 * empty, so a tree-derived answer would drop block layout's grip gutter from the SSR pass.
	 *
	 * A NULL `separator` ANSWERS `undefined`: the value never splits, which is one document with
	 * no rows — the row parse, the block feature gates, the grip gutter and `BlockController` all
	 * turn off together on it.
	 *
	 * AN EMPTY `separator` answers `undefined` too, but reports first: `''` separates nothing
	 * rather than declining to separate, so it is a bad prop and `null` is how the same shape is
	 * asked for on purpose. `Parser.parseRows` refuses `''` outright, so the alternative here is
	 * an exception raised inside the adapter's own render hook; see `shared/reportBadProp`.
	 */
	readonly rowConfig: Computed<RowConfig | undefined> = computed(() => {
		const separator = this.props.separator()
		if (separator === null) return undefined
		if (separator !== '') return {separator, indent: this.props.indent()}
		reportBadProp(
			'`separator` is empty, so this editor has no rows and no row controls. ' +
				'Pass a non-empty separator, or `separator={null}` for a document that never splits.'
		)
		return undefined
	})

	/**
	 * A global offset → the node anchor at it (right affinity). THE offset→anchor direction
	 * for the selection write path.
	 *
	 * Seeds for the same reason the write verbs do: an unmaterialized tree has no roots, so
	 * every offset would answer `'end'`.
	 */
	anchorAt(offset: number): NodeAnchor {
		this.#ensureSeeded()
		return untracked(() => anchorAtOffset(this.#tree.roots(), offset))
	}

	/** Resolve a DOM node to its handle, 'control' if inside a control root, or undefined if outside the container. */
	handleAt(node: Node): TokenHandle | 'control' | undefined {
		return this.#dom.handleAt(node)
	}

	/**
	 * Map a DOM boundary (node, offset) to a node anchor in the LIVE tree — the DOM→model
	 * direction `beforeInput`'s range reads use. The subscription guard lives at
	 * {@link DomModel.anchorFor}, the walk's own entry, so it holds for every caller rather
	 * than only this one.
	 */
	anchorFor(node: Node, offset: number, affinity?: BoundaryAffinity): NodeAnchor | undefined {
		return this.#dom.anchorFor(node, offset, affinity)
	}

	/** Viewport rect of the caret/selection (see {@link DomModel.caretRect}). */
	caretRect(): DOMRect | undefined {
		return this.#dom.caretRect()
	}

	/** DOM TRUTH as anchors: see {@link SelectionDriver.domAnchors}. */
	domAnchors(): Anchors | undefined {
		return this.#selectionDriver.domAnchors()
	}

	/** Move focus (and the caret) into the first root token; see {@link SelectionDriver.focusFirst}. */
	focusFirst(): void {
		this.#selectionDriver.focusFirst()
	}

	/** Current selection serialized for clipboard use. */
	selectedContent(): {html: string; text: string} | undefined {
		return this.#dom.selectedContent()
	}

	// ═══ Wiring ═══════════════════════════════════════════════════════════════

	constructor(
		private readonly props: PropsModel,
		private readonly host: Host
	) {
		host.onMounted(() => {
			// FIRST, because the container is the walk's stop condition: a control registered
			// before one attached marked nothing, and a container SWAP invalidates every chain
			// marked against the previous host.
			this.#controlRoots.rebuild()
			// Order matters: the immediate arrival seeds the pipeline, so the bind effect
			// installed right after can bind a pre-built DOM — the shell is live once the
			// container attaches.
			//
			// ONE watch over the (value, parser, rowConfig) tuple: a simultaneous props
			// change is one wave and one commit, where separate watches would adopt (and
			// announce) several times.
			//
			// `rowConfig`, not the props behind it: the tuple carries what the PARSE
			// consumes, so the two spellings of "no rows" — `null` and the reported `''` —
			// arrive here as the one word the parse reads, and neither wakes the clock twice.
			watch(
				() => ({
					value: this.props.value(),
					parser: this.#parser(),
					rowConfig: this.rowConfig(),
				}),
				(next, previous) => {
					if (previous && next.value === previous.value && this.#seeded()) {
						// Only the tokenization changed: re-derive from the unchanged projection.
						this.#boundary.reparse()
						return
					}
					// The IMMEDIATE run has no `previous`, so it always takes this arm — including
					// on a re-attach, which rebuilds the onMounted scope and re-runs this watch.
					// An uncontrolled re-attach arrives with no value and resolves to the tree's
					// own, which is what carries the edit across (gate:
					// `TokenModel.value.spec`'s 'a container re-attach keeps the uncontrolled edit').
					this.#onExternalValue(next.value)
				},
				{immediate: true}
			)
		})

		// LAST, so the driver's own `onMounted` runs after the arrival above. See
		// {@link TokenModel.#selectionDriver} for why this is not a field initializer.
		this.#selectionDriver = new SelectionDriver({
			selection: this.selection,
			host,
			readOnly: () => this.props.readOnly(),
			bound: this.#pipeline.bound,
			nodes: () => this.nodes(),
			find: id => this.find(id),
			handle: id => this.handle(id),
			dom: this.#dom,
		})
	}

	// ─── internals ─────────────────────────────────────────────────────────────

	/**
	 * The markups, compared SHALLOWLY, and that is the whole point of splitting them out:
	 * `props.options` is a plain signal with no equality, and a fresh-but-identical array (an
	 * inline `options={[…]}` prop on every parent render; Vue's `syncProps` allocates one per
	 * watch run) would mint a new `Parser` here. Descriptors are interned PER PARSER and `adopt`
	 * pairs marks on descriptor identity, so a new parser remounts every Mark with a NEW ID —
	 * and with it every consumer component keyed by that id, on every keystroke of a controlled
	 * Vue editor. Gated by `TokenModel.parse.spec`'s "a fresh but identical `options` array".
	 */
	readonly #markups: Computed<(Markup | undefined)[]> = computed(() => this.props.options().map(opt => opt.markup), {
		equals: shallow,
	})

	/** Whether ANY mark component is configured — the parser is pointless without one. */
	readonly #hasMark: Computed<boolean> = computed(() => {
		const Mark = this.props.Mark()
		return Mark != null || this.props.options().some(opt => 'Mark' in opt && opt.Mark != null)
	})

	/**
	 * WHAT EACH OPTION DECLARES ABOUT ROWS, as the parser reads it, compared BY VALUE beside
	 * {@link #markups} and for the same reason: the pair is what the parser is built from, and a
	 * fresh-but-identical `options` array must not mint a new one. A split record is allocated per
	 * evaluation, so `shallow` alone would do exactly that.
	 *
	 * A split's `as` is resolved to an option INDEX here, by the identity that survives the props
	 * boundary: the `row` spec object. The option objects themselves do not — the Vue adapter
	 * rebuilds every one of them on each prop sync — and that is the same reference trap that made
	 * `turnInto` unreachable in Vue before it resolved kinds by markup. An unresolvable target keeps
	 * its `-1` until {@link #parser}, which is where a bad prop is reported.
	 */
	readonly #rowKinds: Computed<(RowDeclaration | undefined)[]> = computed(
		() => {
			const options = this.props.options()
			return options.map(option => {
				const split = option.row?.split
				if (!split) return option.row !== undefined
				return {
					at: split.at,
					as: options.findIndex(other => other.row !== undefined && other.row === split.as.row),
				}
			})
		},
		{equals: (a, b) => a.length === b.length && a.every((kind, index) => sameRowDeclaration(kind, b[index]))}
	)

	/**
	 * DOWNSTREAM OF {@link #markups}' EQUALITY GATE, and that is what makes the validation
	 * report affordable here: `props.options` compares array ELEMENTS by reference, so an
	 * inline `options={[…]}` prop is never equal across renders, while `#markups` compares the
	 * MARKUP STRINGS. Validating in `#markups` reports once per parent render; validating here
	 * reports once per distinct markup set. Pinned in `TokenModel.parse.spec`.
	 */
	readonly #parser: Computed<Parser | undefined> = computed(() => {
		const declared = this.#rowKinds()
		// A row kind needs a parser of its own even with no Mark anywhere: it is the scanner,
		// not the alternation, that recognises it.
		if (!this.#hasMark() && !declared.some(Boolean)) return
		const {markups, rows} = usableOptions(this.#markups(), declared)
		// An ANONYMOUS kind carries no markup, so the markup array alone no longer says whether
		// this editor has anything to parse.
		if (!markups.some(Boolean) && !rows.some(Boolean)) return
		return new Parser(markups, rows)
	})

	/** THE tree, and the only representation of the value. */
	readonly #tree = createTokenTree([], () => this.#commands)

	/** Whole-node replacement — the mark verbs' write path. */
	#applyStructural(target: TreeNode, replacement: string): boolean {
		this.#ensureSeeded()
		return this.#tx.applyStructural(target, replacement)
	}

	/**
	 * The node verbs, lowered onto `#applyStructural`. Read-only and dead-node gating live
	 * in the transaction layer, so every arm answers exactly what it answers.
	 *
	 * `remove` also MOVES THE CARET, which `update` does not: a removal takes a position out
	 * of the document, so the caret has to be told where that position went, while an update
	 * leaves the caret's own coordinates to adoption's repair. The offset is formed here for
	 * {@link replaceBetween}'s reason — this is the layer that may — and resolved against the
	 * POST-splice tree, so it names the node that took the removed one's place.
	 */
	readonly #commands: TreeCommands = {
		update: (node, patch) => this.#applyStructural(node, serializeMark(node, patch)),
		remove: node => {
			let removed = false
			// One tick for value and selection, exactly as `EditController.replace` batches its pair.
			batch(() => {
				// A row whose subtree ends the document owns no separator, so its removal takes the
				// preceding one with it — see {@link removePlan}. Every other node keeps the plain
				// structural splice below.
				const plan = untracked(() => removePlan(this.#tree.roots(), node, this.#tree.config()?.separator))
				if (plan) {
					if (!this.#tx.applyRange({start: plan.start, end: plan.end, insertedLength: 0}, '')) return
					removed = true
					this.#applyCaret(this.anchorAt(plan.start))
					return
				}
				const {start, end} = untracked(() => node.position)
				// A zero-width node has nothing to remove: refuse instead of committing a
				// no-op splice that fires onChange with the unchanged value.
				if (start === end) return
				if (!this.#applyStructural(node, '')) return
				removed = true
				this.#applyCaret(this.anchorAt(start))
			})
			return removed
		},
		duplicate: node => {
			const projection = this.valueBetween({before: node}, {after: node})
			// A row whose subtree ends the document carries no separator; without one between the
			// copies they fuse into a single row (issue 08 review finding). See
			// {@link endsDocument} for why that is a walk rather than a root-list index.
			const text = untracked(() =>
				endsDocument(this.#tree.roots(), node)
					? (this.#tree.config()?.separator ?? '') + projection
					: projection
			)
			return this.#insertAfter(node, text)
		},
		insertAfter: (node, text) => this.#insertAfter(node, text),
		/**
		 * The boundary between the pair, removed as the window that holds them apart. `node` is the
		 * one that survives adoption — it re-pairs at its own index, same descriptor — so the merged
		 * row keeps the FIRST row's identity AND its kind, and `next`'s id is what the commit
		 * reports removed.
		 *
		 * The caret goes where the two halves join, which is the boundary's start read in the
		 * PRE-splice coordinates and resolved against the post-splice tree.
		 */
		mergeWith: (node, next) => {
			let merged = false
			batch(() => {
				const plan = untracked(() => mergePlan(this.#tree.roots(), node, next, this.#tree.config()?.separator))
				if (!plan) return
				if (!this.#tx.applyRange({start: plan.start, end: plan.end, insertedLength: 0}, '')) return
				merged = true
				this.#applyCaret(this.anchorAt(plan.start))
			})
			return merged
		},
		/**
		 * Deliberately NO {@link #applyCaret}, unlike every other verb here: a removal or an
		 * insertion takes a position out of the document or puts one in, so the caret has to be
		 * told where it went. A move takes NONE out — every node keeps its content and its
		 * identity — so the anchors the selection already holds still name the same characters,
		 * and adoption carries them through untouched. RE-INDENTING does not change that: a lead
		 * is the ROW's structural bytes and lives in no text node, so no anchor can name one.
		 */
		moveTo: (nodes, placement) => {
			this.#ensureSeeded()
			const plan = untracked(() => movePlan(this.#tree.roots(), nodes, placement, this.#tree.config()))
			if (!plan) return false
			return this.#tx.applyRange(plan.window, plan.text)
		},
		/**
		 * {@link moveTo}'s rule for the caret applies verbatim: a re-indent takes no position out
		 * of the document and puts none in — every text node keeps its content — so the anchors
		 * the selection already holds still name the same characters, and the verified pairing
		 * carries them through untouched.
		 */
		setDepth: (node, depth) => {
			this.#ensureSeeded()
			const plan = untracked(() => depthPlan(this.#tree.roots(), node, depth, this.#tree.config()))
			if (!plan) return false
			return this.#tx.applyRange(plan.window, plan.text)
		},
		/**
		 * The one verb that takes an OPTION rather than a string, because a kind is not a markup a
		 * caller may invent: writing an UNREGISTERED markup would emit bytes the scan reads back as
		 * a paragraph, so the option is resolved to the descriptor the scan itself holds and the
		 * verb declines when there is none. Registration is the whole test — an option carrying a
		 * markup this editor compiled is accepted whatever object it arrived in.
		 *
		 * No {@link #applyCaret}, for {@link moveTo}'s reason with one addition: a retype rewrites
		 * the row's structural bytes around a body it leaves alone, so an anchor inside that body
		 * still names the same character and adoption's own repair moves it by the delta. That
		 * holds because {@link turnIntoPlan} trims the window to the changed bytes — an untrimmed
		 * one puts the body INSIDE the window, where the repair collapses every anchor onto its end.
		 */
		turnInto: (node, option, patch) => {
			this.#ensureSeeded()
			const descriptor = option && untracked(() => this.#rowKind(option))
			if (option !== undefined && descriptor === undefined) return false
			const plan = untracked(() => turnIntoPlan(this.#tree.roots(), node, descriptor, patch))
			if (!plan) return false
			return this.#tx.applyRange(plan.window, plan.text)
		},
		/**
		 * A split PUTS A POSITION IN, so unlike a retype it moves the caret — into the row it
		 * produced, named by the pre-order index the plan answers. {@link splitPlan} forms that
		 * index because it is the one layer that may.
		 */
		splitAt: (node, at) => {
			this.#ensureSeeded()
			let split = false
			batch(() => {
				const plan = untracked(() =>
					splitPlan(this.#tree.roots(), node, at, this.#tree.config()?.separator, this.#continues(node))
				)
				if (!plan) return
				if (!this.#tx.applyRange(plan.window, plan.text)) return
				split = true
				this.#enterRow(plan.tail)
			})
			return split
		},
	}

	/** The compiled row kind an option declares, resolved by its MARKUP — see {@link Parser.rowKind}. */
	#rowKind(option: CoreOption): MarkupDescriptor | undefined {
		return this.#parser()?.rowKind(option.markup)
	}

	/** Does this row's kind carry into the row a split produces — see {@link rowSpec}. */
	#continues(node: RowNode): boolean {
		return this.rowSpec(node)?.continues === true
	}

	/**
	 * Both insert verbs, and the caret rule they share: the caret belongs at the START of what
	 * was inserted, which is the POSITION the anchor node was followed by — read before the
	 * splice, resolved after it, so for a slot-leading row markup it lands inside the fresh row's
	 * slot rather than before its opener.
	 *
	 * The position is an index into {@link rowSequence}, and for a ROW it skips the anchor's whole
	 * SUBTREE: `applyAfter` splices at the node's span end, which under nesting is past every
	 * descendant, so what follows a row is the row after its last one.
	 */
	#insertAfter(node: TreeNode, text: string): boolean {
		this.#ensureSeeded()
		let inserted = false
		batch(() => {
			const at = untracked(() => {
				const index = rowSequence(this.#tree.roots()).indexOf(node)
				return index < 0 ? undefined : index + (node.kind === 'row' ? preorderRows([node]).length : 1)
			})
			if (!this.#tx.applyAfter(node, text)) return
			inserted = true
			// A node the sequence does not name — an inline node inside a row — leaves the caret
			// to adoption's repair, exactly as a nested node did before rows nested.
			if (at !== undefined) this.#enterRow(at)
		})
		return inserted
	}

	/**
	 * Put the caret INTO {@link rowSequence}'s entry at `index` — {@link entryAnchor}'s one rule,
	 * applied after the splice so the row exists to be named. A no-op when no such entry came
	 * back, which is what controlled mode always looks like: the tree has not moved, so
	 * {@link #applyCaret} would decline anyway.
	 */
	#enterRow(index: number): void {
		// `.at` for `entryAnchor`'s reason; a negative index cannot arrive here — every
		// caller derives it from a sequence index or a literal 0.
		const row = untracked(() => rowSequence(this.#tree.roots()).at(index))
		if (row) this.#applyCaret(entryAnchor(row))
	}

	/**
	 * A verb's post-edit caret, under the ONE controlled-mode rule (spec D6): controlled mode
	 * moves no DERIVED caret, because the tree has not moved yet — the anchor would be captured
	 * as `selectionBefore` at the echo and shifted a SECOND time by `map`. The echo's repair
	 * owns it there.
	 */
	#applyCaret(caret: NodeAnchor): void {
		if (this.props.value() !== undefined) return
		this.selection.select(caret)
	}

	/** The lazily-materialized default, so a `defaultValue` set after the first read stays a no-op. */
	readonly #seed = signal({initial: () => this.props.defaultValue() ?? ''})
	/**
	 * Does the tree hold a value yet — DERIVED, not stored. An unmaterialized tree is built
	 * from an empty array and has no roots; any parse gives at least one, because the parser
	 * always emits a leading text token. The empty document is the input that could have made
	 * this wrong and does not: `''` parses to ONE empty text root, so an editor cleared to
	 * nothing stays cleared instead of re-seeding from `defaultValue` on the next arrival.
	 *
	 * Reads a signal, so {@link value} still routes reactively — that was the reason the
	 * stored form had to be a signal rather than a plain flag.
	 */
	readonly #seeded = () => this.#tree.roots().length > 0

	readonly #boundary = createBoundary({
		tree: this.#tree,
		parser: () => this.#parser(),
		rowConfig: () => this.rowConfig(),
		controlled: () => this.props.value() !== undefined,
		selection: () => this.selection.anchors(),
		onChange: next => this.props.onChange()?.(next),
		// Synchronous by contract, and the ORDER is load-bearing: `selection.repair` runs after
		// `apply`, so an imperative post-edit caret (`EditController`) lands later in the same
		// batch and wins by design. The batch here is nested inside the boundary's own — the
		// commit is atomic as a whole — and it is kept because this pair has its own ordering
		// to state.
		onResult: result =>
			batch(() => {
				this.#pipeline.apply()
				this.selection.repair(result)
			}),
		onEdit: record => this.edits(record),
	})

	readonly #tx = createTransactions({
		tree: this.#tree,
		readOnly: () => this.props.readOnly(),
		sink: this.#boundary.sink,
		syncSelection: () => this.#selectionDriver.syncFromDom(),
	})

	/**
	 * One router for every external value: the props watch, and `#ensureSeeded`.
	 *
	 * THE FALLBACK IS THE TREE. An arrival with no value means no parent owns it, and what the
	 * editor keeps is what it is already showing — the seed answers only before the tree holds
	 * anything at all. There is no memory of an earlier uncontrolled era: a `#restore` string
	 * frozen at the moment control was taken used to serve three arms, and two of them (a
	 * container re-attach, an edit made before mount) are the tree's own value by then. The
	 * third was the behaviour change that removed it — see the commit body.
	 */
	#onExternalValue(value: string | undefined): void {
		const next = value ?? (this.#seeded() ? this.#tree.value() : this.#seed())
		this.#boundary.arrive(next)
	}

	/**
	 * The tree's materialization point: the write path materializes on first use rather than
	 * waiting for mount, because several specs edit an UNMOUNTED store.
	 *
	 * Reads TRACKED, where every other read on the write path is `untracked`: wrapping this one
	 * drops the roots/`#seed` subscription a reactive writer on an unseeded store gets today.
	 */
	#ensureSeeded(): void {
		if (this.#seeded()) return
		this.#onExternalValue(this.props.value())
	}

	/**
	 * The control roots' DOM membership. Not a registry beside the other three: nothing here is
	 * keyed by a token, and the only question ever asked of it is whether an element sits under a
	 * control — so it owns its own answer instead of being recomputed by a walk that has a tree.
	 */
	readonly #controlRoots: ControlRoots = createControlRoots(() => untracked(() => this.host.container()))

	/** THE live node layer, keyed by stable token id — mutated only through the pipeline. */
	readonly #nodes = new Map<number, TokenHandle>()

	readonly #pipeline = createCommitPipeline({
		container: () => this.host.container(),
		nodes: this.#nodes,
		roots: () => this.#tree.roots(),
		source: {
			tokenElement: id => this.#tokenElements.latest(id),
			childSequenceHost: ownerId => this.#childSequenceHosts.sole(ownerId),
			rowSequenceHost: ownerId => this.#rowSequenceHosts.sole(ownerId),
		},
	})

	// All DOM-related reads/commands live in DomModel; the public methods above are one-line
	// delegations. The deps are private closures over the pipeline: nothing DOM-shaped leaks.
	readonly #dom = new DomModel({
		container: () => this.host.container(),
		byElement: element => this.#pipeline.byElement(element),
		isControlRoot: element => this.#controlRoots.has(element),
		roots: () => this.nodes(),
		find: id => this.find(id),
		handle: id => this.handle(id),
	})

	/**
	 * The selection's DOM half. BUILT IN THE CONSTRUCTOR, not as a field initializer: an
	 * initializer would read `this.host` — a parameter property, which `tsc` rejects with
	 * TS2729 — and `this.#pipeline`, which answers `undefined` silently from above it.
	 */
	readonly #selectionDriver: SelectionDriver

	// THE ref registries — populated by framework ref callbacks, read by bind. Owner-indexed, so
	// one id's element is one lookup: `rebind(id)` answers a single ref, and a registry that had
	// to be scanned or rebuilt to serve it would put the whole document back into the cost of one
	// registration. That is not a micro-optimisation — it is the difference between a linear
	// mount and a quadratic one, measured.
	readonly #tokenElements = new RefRegistry()
	readonly #childSequenceHosts = new RefRegistry()
	readonly #rowSequenceHosts = new RefRegistry()

	/** The shared ref-callback body: one key per registration, filed into `registry` under `id`. */
	#refInto(registry: RefRegistry, id: number): DomRef {
		const key = {}
		return element => {
			if (element) {
				registry.set(id, key, element)
			} else {
				registry.delete(id, key)
			}
			this.#pipeline.rebind(id)
		}
	}
}

/**
 * The sequence an insert names a position in: the document's rows in PRE-ORDER once anything
 * parses as one, and the ROOTS otherwise.
 *
 * ONE space rather than two, because at depth 0 the two agree — with no nesting the rows in
 * pre-order ARE the roots — and pre-order is the only one that survives nesting, where a root
 * index stops naming a row at all. With no row parse there are no rows and the roots are the
 * inline tokens, which is the space the mark verbs have always named.
 */
function rowSequence(roots: readonly TreeNode[]): readonly TreeNode[] {
	const rows = preorderRows(roots)
	return rows.length > 0 ? rows.map(entry => entry.row) : roots
}

/**
 * The options as the parser may take them: each markup string itself, or `undefined` when it
 * breaks a rule, beside the row declaration that survives with it. `undefined` is the shape the
 * parser ALREADY supports for "this option contributes no markup" — `MarkupRegistry` skips it while
 * preserving the original indices, so the surviving options keep their `descriptor.index` and their
 * per-option component. A DROPPED markup drops its row declaration with it, or an option reported
 * for a bad markup would come back as an anonymous kind.
 *
 * Refused rather than thrown for the reason in `shared/reportBadProp`: the parser is rebuilt
 * inside the props watch a per-render `props.set` drains, so the throw would leave the
 * adapter's own lifecycle hook.
 *
 * A ROW markup answers to `rowMarkupError` as well, and to one rule no single markup can decide
 * alone: two kinds compiling to the same opener are indistinguishable at a row's start, so the
 * later one is dropped rather than shadowed silently. A SPLIT answers to two more, both of which
 * cost the kind its carve rather than its existence: a delimiter has to be something (an empty one
 * matches at every offset), and its target has to be a row option of this editor.
 */
function usableOptions(
	markups: readonly (Markup | undefined)[],
	declared: readonly (RowDeclaration | undefined)[]
): {markups: (Markup | undefined)[]; rows: (RowDeclaration | undefined)[]} {
	const openers = new Set<string>()
	const rows = [...declared]
	const drop = (index: number): undefined => {
		rows[index] = undefined
		return undefined
	}
	const result = markups.map((markup, index) => {
		const row = rows[index]
		const split = rowSplitOf(row)
		if (split?.at === '') {
			reportBadProp(
				'A row `split.at` is empty, so this kind carves nothing. Pass the literal its cells are separated by.'
			)
			rows[index] = true
		} else if (split && split.as < 0) {
			reportBadProp(
				'A row `split.as` names an option this editor does not carry, so this kind carves nothing. ' +
					'Pass one of the same `options`, and give it a `row`.'
			)
			rows[index] = true
		}
		if (markup === undefined) return undefined
		if (!row) {
			const invalid = markupError(markup)
			if (invalid === undefined) return markup
			reportBadProp(`${invalid}. This option contributes no markup.`)
			return undefined
		}
		const invalid = rowMarkupError(markup)
		if (invalid !== undefined) {
			reportBadProp(`${invalid}. This option contributes no row kind.`)
			return drop(index)
		}
		const opener = rowOpener(markup)
		if (openers.has(opener)) {
			reportBadProp(
				`Duplicate row opener "${opener}" in "${markup}". An earlier row option already claims it, ` +
					'so this option contributes no row kind.'
			)
			return drop(index)
		}
		openers.add(opener)
		return markup
	})
	return {markups: result, rows}
}

/** Two row declarations by VALUE — see {@link TokenModel.#rowKinds}. */
function sameRowDeclaration(a: RowDeclaration | undefined, b: RowDeclaration | undefined): boolean {
	const [left, right] = [rowSplitOf(a), rowSplitOf(b)]
	if (left && right) return left.at === right.at && left.as === right.as
	return a === b
}

/**
 * A patch becomes markup: `null` clears a field, an omitted key round-trips the current one.
 *
 * The defaults come off the NODE, and the slot's current value is the joined children,
 * because the node stores no slot text (`MarkNode.slotRange` is positions only).
 */
function serializeMark(node: MarkNode, patch: MarkPatch): string {
	const value = patch.value ?? node.value()
	const meta = patch.meta === null ? undefined : (patch.meta ?? node.meta())
	const slot = patch.slot === null ? undefined : (patch.slot ?? node.slot())
	return annotate(node.markup, {
		value,
		meta: node.descriptor.gapTypes.includes('meta') ? (meta ?? '') : undefined,
		slot: node.descriptor.hasSlot ? (slot ?? '') : undefined,
	})
}

/**
 * One ref registry: elements filed under an owner id, and inside it under the REGISTRATION that
 * produced them — so a ref outliving a re-render cannot be filed under a stale key, and a stale
 * null-call cannot delete a newer element.
 */
class RefRegistry {
	readonly #byOwner = new Map<number, Map<object, HTMLElement>>()

	set(ownerId: number, key: object, element: HTMLElement): void {
		let registrations = this.#byOwner.get(ownerId)
		if (!registrations) {
			registrations = new Map<object, HTMLElement>()
			this.#byOwner.set(ownerId, registrations)
		}
		registrations.set(key, element)
	}

	delete(ownerId: number, key: object): void {
		const registrations = this.#byOwner.get(ownerId)
		if (!registrations) return
		registrations.delete(key)
		if (registrations.size === 0) this.#byOwner.delete(ownerId)
	}

	/** The newest registration for one owner — insertion order, so the last ref to fire wins. */
	latest(ownerId: number): HTMLElement | undefined {
		let latest: HTMLElement | undefined
		for (const element of this.#byOwner.get(ownerId)?.values() ?? []) latest = element
		return latest
	}

	/**
	 * The SOLE registration for one owner, or `undefined` when there is none or more than one.
	 * Two live registrations mean two generations are on the page, and the caller declines rather
	 * than guessing which is this one's.
	 */
	sole(ownerId: number): HTMLElement | undefined {
		const registrations = this.#byOwner.get(ownerId)
		if (registrations?.size !== 1) return undefined
		return this.latest(ownerId)
	}
}