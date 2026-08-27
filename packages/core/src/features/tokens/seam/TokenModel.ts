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
import {rowCloser, rowMarkupError, rowOpener, rowSplitOf} from '../parser/core/RowKind'
import {Parser} from '../parser/Parser'
import type {Markup, RowConfig} from '../parser/types'
import {annotate} from '../parser/utils/annotate'
import {
	adjacentMark as findAdjacentMark,
	anchorAt as anchorAtOffset,
	anchorEquals,
	boundarySpan as findBoundarySpan,
	entryAnchor,
	offsetOfAnchor,
	slotWithout,
	stepAnchor,
} from '../tree/anchors'
import {gapWindow} from '../tree/gapWindow'
import {hasCells, hasRawBody, preorderRows} from '../tree/rows'
import {createSelection} from '../tree/selection'
import type {Selection} from '../tree/selection'
import type {Continuation} from '../tree/siblings'
import {
	contentSpan,
	depthPlan,
	dropPlacements,
	endsDocument,
	mergePlan,
	movePlan,
	removePlan,
	rowOf,
	rowScope,
	rowSelectionRows,
	rowSelectionSpan,
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
	 * updates in place. Routing a ref through the bind counter makes a mount with rows quadratic —
	 * a document with rows used to mount up to four controls per ROW, measured at 400 rows / 400 binds /
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

	/**
	 * The framework finished painting a ROW, and this is the one prop a kind's component can drop
	 * with no other sign of it. `RowProps.ref` is optional, so forgetting to spread it type-checks;
	 * what it costs is total and invisible — the row is never consigned, so it binds to nothing,
	 * has no anchors, and the caret cannot resolve into it.
	 *
	 * IT IS THE ADAPTER'S FACT TO HAND OVER, not core's to derive. `bind` runs on the COMMIT, which
	 * is before the frame that paints it, so a row unconsigned there is the ordinary case of an
	 * element that has not arrived yet. "The component that paints this row ran and its ref did not
	 * fire" is a question only the caller that rendered it can answer, and both adapters ask it
	 * whenever the component changes — a mount, and a TURN-INTO, which keeps the row's node and
	 * swaps the kind underneath it. Mount alone missed the slash menu, which is how a consumer
	 * meets their own new kind first.
	 *
	 * REPORTED, NOT REPAIRED, and not extended to the row's other two props. There is nothing to
	 * repair: without a consignment core has no element, and inventing one by walking the DOM is
	 * the re-derivation consignment replaced. `className` and `style` are left alone deliberately —
	 * their loss is a row that looks wrong, while this is a row the editor cannot use at all.
	 *
	 * Once per painted row rather than once per kind: it takes a Set to say the latter, and a
	 * document holding many rows of one broken kind is a document whose author is about to fix it.
	 *
	 * THE VERDICT WAITS A FRAME, because the mount hook is one moment and a correct row kind is
	 * allowed to arrive after it — an SSR guard, a lazy chart, a `defineAsyncComponent`, anything
	 * that paints `null` first and its element on a flip set from its own mount. React processes
	 * that flip after the passive flush and Vue queues it the same way, so both adapters' hooks see
	 * the element-less commit and the check accused the one mistake the author had not made. A row
	 * that is genuinely unbound stays unbound for the life of the document, so the wait costs
	 * nothing. The caller gets the cancel back and owns the row's lifetime: a row taken out of the
	 * document before the frame is not a row that failed to paint.
	 */
	rowPainted(node: RowNode): () => void {
		const frame = requestAnimationFrame(() => {
			if (this.#tokenElements.latest(node.id) !== undefined) return
			const markup = node.descriptor()?.markup
			reportBadProp(
				`${markup === undefined ? 'The `slots.paragraph` component' : `The row kind "${markup}"`} rendered no ` +
					'element the editor could bind: spread `ref` onto the one element the component renders. ' +
					'Until it does, the caret cannot resolve into this row.'
			)
		})
		return () => cancelAnimationFrame(frame)
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
		const span = untracked(() => {
			const roots = this.#tree.roots()
			const a = offsetOfAnchor(roots, from)
			const b = offsetOfAnchor(roots, to)
			return {start: Math.min(a, b), end: Math.max(a, b)}
		})
		return this.#replaceWithin(span.start, span.end, text)
	}

	/**
	 * THE ROW SELECTION'S OWN EDIT: replace the rows `anchors` covers WHOLE — their leads and their
	 * openers included — with `rows`, or remove them outright for `null`. Answers whether it wrote,
	 * so a caller whose selection is not a whole number of rows falls through to its ordinary path.
	 *
	 * A VERB rather than a widened selection, and the reason is the encoding: the span starts at the
	 * row's LINE, and a row's lead and opener are structural bytes no anchor can name (ADR-0010's
	 * rule, and `rowSpan`'s own docstring). The four gestures that act on a row selection — paste,
	 * cut, Backspace and Enter — all reach this one, so what a selection copies, what it cuts and
	 * what a paste replaces are the same bytes. See {@link rowSelectionSpan}.
	 *
	 * `null` REMOVES, `''` leaves ONE EMPTY ROW, and the difference is the boundary: a removal takes
	 * the separator that held the rows apart from the document with them, where a replacement leaves
	 * it to separate whatever arrives. Enter over a row selection wants the second — it opens a fresh
	 * row exactly as it does over an all-selected document.
	 *
	 * WHOSE LANGUAGE `rows` IS WRITTEN IN is the difference between the two replacement forms, and
	 * it is the same distinction {@link Replacement} draws at the event. A STRING is the value's own
	 * projection — leads, openers and separators already in it — and is spliced verbatim; that is
	 * this editor's own clipboard entry, and Enter's empty row. An ARRAY is LINES, in nobody's
	 * language, and each one is OPENED as a row at the covered rows' lead and kind
	 * ({@link rowSelectionRows}) — which is what a foreign clip is, and what the caret path has
	 * always done with one. Spliced verbatim instead, a foreign clip's `\r` survived into the value
	 * and its `⏎` became a row boundary in a document whose separator is not one.
	 */
	replaceRows(anchors: Anchors, rows: string | readonly string[] | null): boolean {
		this.#ensureSeeded()
		let written = false
		// One tick for value and selection, as `EditController.replace` batches its own pair.
		batch(() => {
			const separator = untracked(() => this.#tree.config()?.separator)
			const span = untracked(() =>
				rowSelectionSpan(this.#tree.roots(), anchors, separator, rows === null ? 'remove' : 'replace')
			)
			if (!span || separator === undefined) return
			const first = span.rows[0]
			const text =
				rows === null || typeof rows === 'string'
					? (rows ?? '')
					: untracked(() => rowSelectionRows(first, this.#continues(first), rows, separator))
			// A WRITE MAY NOT TAKE CONTENT THE USER CANNOT SEE, on this door as on the text one
			// ({@link #hiddenWithin}). The span itself is written whole and each hidden subtree is
			// put BACK into it, because the rule is a per-subtree exclusion: a span truncated at
			// the first hidden row leaves every visible row beyond it standing, which over two
			// collapsed toggles is a delete the user watched skip rows they had selected.
			const value = untracked(() => this.#tree.value())
			const kept = this.#hiddenWithin(span)
				.map(hidden => value.slice(hidden.start, Math.min(hidden.end, span.end)))
				.map(line => (line.endsWith(separator) ? line.slice(0, -separator.length) : line))
				.join(separator)
			// A REMOVAL'S SPAN IS WHOLE LINES PLUS ONE ADJOINING SEPARATOR — leading when the run
			// ends the document ({@link rowSelectionSpan}), trailing otherwise — so whatever
			// survives has to carry that same separator back. A replacement's span adjoins none,
			// and its own text comes first.
			const write =
				kept === ''
					? text
					: rows === null
						? (span.start === first.position.start ? '' : separator) +
							kept +
							(span.end === value.length ? '' : separator)
						: text + separator + kept
			const caret = this.#replaceWithin(span.start, span.end, write)
			if (!caret) return
			written = true
			this.#applyCaret(caret)
		})
		return written
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
		return this.#optionOf(node)?.row
	}

	/**
	 * THE OPTION a row's kind was declared by — the identity {@link rowSpec} already reads off the
	 * option index, kept whole for the one question `row` cannot answer: what a NEW row of this
	 * kind starts as, which the option declares once in `menu` for every door that opens one.
	 */
	#optionOf(node: RowNode): CoreOption | undefined {
		return untracked(() => {
			const index = node.option()
			return index === undefined ? undefined : this.props.options()[index]
		})
	}

	/**
	 * DOES TAB BELONG TO THIS EDITOR — one answer per editor, not one per row, and that is the whole
	 * of what `RowSpec.indents` decides.
	 *
	 * The declaration answers an ACCESSIBILITY question (ADR-0002: Tab leaves the field unless the
	 * editor has a use for it), and an accessibility question is about the field. Whether a
	 * PARTICULAR row may go one level deeper is a structural question, and it already has an owner
	 * in {@link indentRows} — the scan's ceiling plus {@link #nestingIsPainted}, which is also what
	 * the DROP asks through {@link dropPlacements}. Read per KIND, the two disagreed: measured over
	 * the Notion showcase's 35 rows, four of them — a heading after a callout, a table of contents,
	 * a bookmark, a heading after a to-do — were offered depth 1 by the drag and accepted by the
	 * verb while Tab was not even consumed, so the key fell through and took focus out of the
	 * editor. That is the very split `indents` was written to prevent ("a Tab that sometimes moves
	 * focus and sometimes indents is worse than either"), one level up: it prevented it inside a
	 * kind and produced it between kinds of one document.
	 */
	readonly rowsIndent: Computed<boolean> = computed(() =>
		this.props.options().some(option => option.row?.indents === true)
	)

	/**
	 * THE ROWS A SELECTION HOLDS — the one reading, and the whole of it. What `store.rows.selected`
	 * paints, what the drag picks up, what Esc asks before it climbs and what Tab moves;
	 * {@link replaceRows} writes over the span the same test answers. There is no second store of
	 * selected rows because a row selection IS the text selection, read at row granularity.
	 *
	 * EXACTLY those rows: a span running from the middle of one row into the end of another covers
	 * the row between them whole and is still a TEXT selection, so the set is empty there. The paint
	 * used to say otherwise and Tab believed it — which is how Tab came to indent a row the caret was
	 * not in, while Backspace over the same selection correctly declined. See
	 * {@link rowSelectionSpan}, whose exactness test this is.
	 */
	rowSelection(anchors: Anchors): readonly RowNode[] {
		return untracked(
			() => rowSelectionSpan(this.#tree.roots(), anchors, this.#tree.config()?.separator, 'replace')?.rows ?? []
		)
	}

	/**
	 * THE SPAN A RANGED TEXT EDIT WRITES OVER, as anchors — the selection with each edge resolved
	 * off the structural bytes it landed on ({@link contentSpan}). `undefined` for a caret and for a
	 * selection whose edges are inside a line's content, which is every ordinary text edit and stays
	 * exactly the bytes the event named.
	 *
	 * TYPING IS THE ONE ROW-SELECTION GESTURE THAT STAYS TEXT (see {@link replaceRows} for the
	 * other four), so it needs a span rather than a verb: the rows' own text goes and the first
	 * row's kind stays. But the rule is not the row selection's — the browser ends a selection at
	 * the NEXT line's entry whatever that line is, so a parent's first child and a table's next cell
	 * carried the same unpainted boundary and neither was a row selection at all.
	 *
	 * A ROW THAT HOLDS NO EDITABLE POSITION IS REFUSED, and the caller then replaces the ROW
	 * instead ({@link replaceRows}). It is the caret invariant read at the WRITE: a body no caret
	 * may enter is not prose, it is the kind's own markup — a raw body between its literals, a
	 * carved grid — so text written into it is bytes the kind cannot read back. Measured on a
	 * selected table of contents: `'@toc⏎Section⏎@end'` typed over emitted `'@toc⏎Z- beta'`, the
	 * closing literal gone and the row below merged in. The same reading `#placeInRow` makes, and
	 * the reason it is a DOM one: whether a kind paints its own text is the consumer's, not the
	 * tree's.
	 *
	 * IT ANSWERS THE DELETE PATH TOO ({@link anchorsForDelete}), which used to write the RAW pair
	 * for any ranged selection and so carried every structural byte this resolves off. Its own
	 * refusal is vacuous there: `rowSelection` is non-empty exactly when the selection is an exact
	 * row cover, which is exactly when {@link replaceRows} has already consumed the key upstream.
	 */
	rowSelectionText(anchors: Anchors): Anchors | undefined {
		const span = untracked(() => contentSpan(this.#tree.roots(), this.#offBlockInterior(anchors)))
		if (!span) return undefined
		if (!this.rowSelection(anchors).every(row => this.#dom.reachable(untracked(() => entryAnchor(row)))))
			return undefined
		// `<`, not `<=`: an EMPTY content span is a POSITION rather than a refusal — see
		// {@link contentSpan}'s no-content arm — and refusing one put the raw pair back on the
		// write path, which is the whole defect that arm exists to close.
		const end = this.#visibleEnd(span)
		if (end < span.start) return undefined
		return {anchor: this.anchorAt(span.start), head: this.anchorAt(end)}
	}

	/**
	 * THE SUBTREES INSIDE THE SPAN THE USER CANNOT SEE — a write may not take their content, which is
	 * the invariant this effort already wrote for the CARET (`#settleCaret`'s `'boxless'` arm) and for
	 * NESTING (a kind that hosts no children refuses the rows), now on the write path.
	 *
	 * A COLLAPSED TOGGLE renders its children and hides them, so their text is in the DOM and the
	 * browser's own paragraph walk takes it: MEASURED on the showcase, a triple-click of `'▸
	 * Single-region GA first'` selects its hidden body too — `range.toString()` carries both lines —
	 * and typing over it emitted `'▸ Z'`, 76 lines to 75, the body gone with nothing on screen having
	 * shown it. The same gesture on the OPEN toggle beside it keeps its children, which is what makes
	 * this the collapse and not the selection.
	 *
	 * `'boxless'` IS THE ONLY VERDICT READ HERE. `'absent'` is a frame that has not painted the row
	 * yet — a race — and treating it as hidden would clip a span against the adapter's timing;
	 * `rowPaint` is the three-way reading that keeps those apart.
	 *
	 * A SUBTREE, so its own hidden descendants are not answered twice: a `position` runs to the end
	 * of everything nested under the row, and a collapsed row hides all of it at once.
	 *
	 * TWO DOORS READ THIS, and the difference between them is the whole reason it answers a LIST
	 * rather than a number. {@link rowSelectionText} can only shrink a span, so it takes the first
	 * hidden subtree as the end ({@link #visibleEnd}) — an anchor pair has no way to say "all of
	 * this except the middle". {@link replaceRows} writes offsets, so it puts every hidden subtree
	 * back and takes the rest: truncating there left every VISIBLE row beyond the first collapsed
	 * toggle standing, and a sweep of twenty rows crossing one toggle deleted down to it and left
	 * the other fifteen, with nothing on screen saying why.
	 */
	#hiddenWithin(span: {start: number; end: number}): {start: number; end: number}[] {
		const hidden: {start: number; end: number}[] = []
		let covered = span.start
		for (const row of untracked(() => preorderRows(this.#tree.roots()).map(entry => entry.row))) {
			const position = untracked(() => ({start: row.position.start, end: row.position.end}))
			if (position.start <= span.start || position.start >= span.end || position.start < covered) continue
			if (this.#dom.rowPaint(row.id) !== 'boxless') continue
			hidden.push(position)
			covered = position.end
		}
		return hidden
	}

	/** Where the span stops being visible — the first hidden subtree's line; see {@link #hiddenWithin}. */
	#visibleEnd(span: {start: number; end: number}): number {
		const separator = untracked(() => this.#tree.config()?.separator)
		const first = this.#hiddenWithin(span).at(0)
		if (separator === undefined || first === undefined) return span.end
		return first.start - separator.length
	}

	/**
	 * AN EDGE INSIDE A BLOCK NAMES THE BLOCK, NOT A POSITION IN IT — the reading {@link contentSpan}
	 * cannot make for itself, because whether a kind paints its own text is the consumer's fact and
	 * not the tree's, and because a block's opener is a LINE of the value that no line of content
	 * belongs to.
	 *
	 * TWO EDGES REACH IT, and they are the same sentence read from either side of the seam.
	 *
	 * A frozen row's body has NO surface, so an offset in it is a position no caret may occupy — but
	 * in the VALUE it is an ordinary content offset, indistinguishable from the entry of an editable
	 * row one line down. That is the difference between the two gestures that produce the same shape:
	 * a sweep ending at a heading's first character is a text selection and MERGES the two rows
	 * (`rowKeys.spec`'s 'writes exactly the named span when the selection covers no row whole'), and a
	 * sweep ending at a table of contents' first character has reached bytes the user can neither see
	 * nor edit. MEASURED on the showcase: triple-click the intro paragraph's LAST line and type once —
	 * Chromium ends that range at `(the toc's element, 0)`, which resolves to the toc's own first
	 * content offset, so both edges read as content, the raw span stood, and `@toc` and its first
	 * entry went with the sentence: 76 lines to 74.
	 *
	 * AND AN EDGE THE DOM CAN REACH PERFECTLY WELL STILL NAMES ONE WHERE THE ROW'S BODY IS RAW.
	 * {@link hasRawBody} is the shape: a body bounded by a CLOSING LITERAL rather than by the row's
	 * separator, so its interior already holds separators and the row is several LINES of the value.
	 * A span with one edge in such a body and the other outside the row does not merge two rows —
	 * it deletes the run between them, which is that block's OPENER, and leaves its closing literal
	 * standing as prose. MEASURED on the showcase: click the `Canary procedure` heading, Shift-click
	 * the fence below it, type once — `'## Canary procedureZ'`, ` ```bash ` gone, the two code lines
	 * and the closing ` ``` ` left as four free rows, 76 lines to 74. Backspace over the same sweep
	 * did the same. A selection wholly INSIDE the body is untouched, which is what keeps the fence
	 * editable.
	 *
	 * SO THE EDGE MOVES TO THE ROW'S OWN BOUNDARY, where the offset is structural and `contentSpan`
	 * resolves it the way it resolves every other structural edge — the LOW edge to `{after}` and the
	 * HIGH edge to `{before}`, so the answer can only ever SHRINK.
	 *
	 * THE ROW SELECTION IS READ FROM THE ORIGINAL PAIR and is untouched by this, which is what keeps
	 * round nine's refusal: a frozen row held WHOLE still answers `rowSelection`, `reachable` still
	 * declines it, and the typed character is still consumed and refused rather than replacing the row.
	 */
	#offBlockInterior(anchors: Anchors): Anchors {
		const roots = this.#tree.roots()
		const ends = [offsetOfAnchor(roots, anchors.anchor), offsetOfAnchor(roots, anchors.head)]
		const held = {start: Math.min(...ends), end: Math.max(...ends)}
		const resolve = (anchor: NodeAnchor, low: boolean): NodeAnchor => {
			const row = rowOf(roots, anchor)?.row
			if (!row) return anchor
			if (this.#dom.reachable(anchor) && !this.#cutsBlockOpen(row, held)) return anchor
			return low ? {after: row} : {before: row}
		}
		return {anchor: resolve(anchors.anchor, ends[0] <= ends[1]), head: resolve(anchors.head, ends[0] > ends[1])}
	}

	/** Does `held` reach into `row`'s raw body from outside the row — see {@link #offBlockInterior}. */
	#cutsBlockOpen(row: RowNode, held: {start: number; end: number}): boolean {
		return untracked(() => hasRawBody(row) && (held.start < row.position.start || held.end > row.position.end))
	}

	/**
	 * THE ROW'S OWN CONTENT — what a TRIPLE-CLICK selects, and the reason the editor takes that
	 * gesture at all.
	 *
	 * THE PLATFORM ANSWERS A VISUAL LINE. Measured with no editor loaded and again on the showcase: a
	 * triple-click inside a wrapped paragraph selects exactly the line under the pointer, so the same
	 * gesture on the same row selects a different amount of text depending on where the window edge
	 * falls. Every editor a person has used answers the BLOCK, and every defect the ninth and tenth
	 * driving sessions found arrived through this gesture — its raw range ends on the next row's own
	 * element, which is bytes no highlight showed.
	 *
	 * THE LINE, not the row's subtree: a parent's own content stops where its first CHILD begins
	 * ({@link RowNode.slotRange}), and inside a carved row the piece under the pointer is the line —
	 * the same reading {@link rowOf} makes for every key. So a triple-click in a table cell takes the
	 * cell, not the whole table line, which is what a person pointing at a cell means.
	 *
	 * A ROW WITH NO EDITABLE CONTENT TAKES THE BLOCK SELECTION instead ({@link #selectRow}), which is
	 * the answer a pointer landing on frozen presentation already gets: the toc's own text has no
	 * surface, so a content span there would name two boundaries the DOM cannot paint.
	 */
	selectLine(): boolean {
		const anchors = this.#selectionDriver.domAnchors()
		const found = anchors && this.rowOf(anchors.anchor)
		if (!found) return false
		const line = found.cell ?? found.row
		if (!this.#dom.reachable(untracked(() => entryAnchor(line)))) return this.#selectRow(found.row)
		const range = untracked(() => line.slotRange())
		this.selection.select(this.anchorAt(range.start), this.anchorAt(range.end))
		return true
	}

	/**
	 * THE SPAN a row-selection gesture widens to — see {@link rowScope}. `undefined` when the
	 * gesture has nothing to widen to, which is what leaves the key to the browser.
	 */
	rowScope(anchors: Anchors, scope: 'row' | 'out' | 'up' | 'down'): {start: number; end: number} | undefined {
		return untracked(() => rowScope(this.#tree.roots(), anchors, scope, this.#tree.config()?.separator))
	}

	/**
	 * THE ONE WRITE EVERY ROW-SELECTION GESTURE MAKES — Esc's two rungs, Shift+Up/Down and Mod+A —
	 * as the span {@link rowScope} answered.
	 *
	 * AN END NO SURFACE PAINTS FALLS BACK ON ITS ROW'S OWN ELEMENT EDGE, which is
	 * {@link #selectRow}'s reading generalized from a whole row to one END of a span, and it is what
	 * finishes the arrows. `rowScope` names its ends in ROW coordinates — a row's entry, a row's
	 * content end — and a FROZEN row's text has no surface at all, so `anchorAt` answered a text
	 * node the DOM could not reach, `selectRange` declined, and the DOM selection stayed on whatever
	 * one row the click had put it on. The anchors widened, the paint did not, and the next
	 * keystroke — which reads DOM truth — acted on the one row: half a gesture, which is worse than
	 * either whole one.
	 *
	 * IT IS A NO-OP WHEREVER THE END IS PAINTED, checked rather than assumed, so Esc, Mod+A and the
	 * drag write exactly the anchors they always did on ordinary rows. Only the ends that resolved
	 * to NOTHING move, and an element edge is what a block selection is bounded by
	 * ({@link DomModel.#rangeBoundaryAt}).
	 */
	selectRowSpan(span: {start: number; end: number}): void {
		const covered = untracked(() => rowsWithin(this.#tree.roots(), span, this.#tree.config()?.separator))
		const reach = (offset: number, row: RowNode | undefined, side: 'before' | 'after'): NodeAnchor => {
			const anchor = this.anchorAt(offset)
			if (!row || this.#dom.reachable(anchor)) return anchor
			return side === 'before' ? {before: row} : {after: row}
		}
		this.selection.select(reach(span.start, covered.at(0), 'before'), reach(span.end, covered.at(-1), 'after'))
	}

	/**
	 * EVERY PLACEMENT A DROP INTO ONE GAP MAY TAKE — see {@link dropPlacements}. What the drag layer
	 * turns a pointer's horizontal position into, and the reason the drop indicator cannot promise
	 * a move the mover would refuse.
	 *
	 * The planner is pure tree arithmetic and stays that way; the ONE refusal it cannot make is
	 * {@link #nestingIsPainted}'s, which is a DOM fact. It is applied HERE rather than left to the
	 * drop, so a candidate the mover will refuse is never offered and never painted — the indicator
	 * promises, it does not predict.
	 */
	dropPlacements(
		nodes: readonly RowNode[],
		row: RowNode,
		edge: 'before' | 'after'
	): readonly {depth: number; placement: RowPlacement}[] {
		return untracked(() => dropPlacements(this.#tree.roots(), nodes, row, edge, this.#tree.config())).filter(
			candidate => this.#nestingIsPainted(candidate.placement.parent)
		)
	}

	/**
	 * Move a SET of rows to one placement, in one splice — {@link RowNode.moveTo} widened to what
	 * a multi-row drag names. The set is normalized to maximal subtrees inside the plan, so a
	 * caller may hand over a selection verbatim.
	 *
	 * On the model rather than on a node, because the set has no owning row: `store.rows.move` is
	 * its one caller and the rows it names are peers.
	 */
	moveRows(nodes: readonly RowNode[], placement: RowPlacement): boolean {
		return this.#commands.moveTo(nodes, placement)
	}

	/**
	 * Re-indent a SET of rows by `steps` levels, in one splice — {@link RowNode.setDepth} widened to
	 * what a row selection names, and STEPS rather than a depth because rows picked up from
	 * different depths keep the nesting they had (see {@link depthPlan}).
	 *
	 * On the model rather than on a node for {@link moveRows}'s reason: the set has no owning row.
	 * The keymap's Tab is its caller, and a caret with no row selection standing hands over the one
	 * row it is in — so there is one indent verb rather than a set arm beside a single arm.
	 *
	 * No {@link #applyCaret}, for `moveTo`'s reason: a re-indent takes no position out of the
	 * document and puts none in, so the anchors the selection holds still name the same characters
	 * and the verified pairing carries them through untouched.
	 *
	 * AND IT REFUSES A DESTINATION NOTHING PAINTS — {@link #nestingIsPainted}, which is the caret
	 * invariant read at the gestures that can move a row out from under it.
	 */
	indentRows(nodes: readonly RowNode[], steps: number): boolean {
		this.#ensureSeeded()
		if (steps > 0 && !nodes.every(node => this.#nestingIsPainted(this.#parentOneLevelDeeper(node)))) return false
		const plan = untracked(() => depthPlan(this.#tree.roots(), nodes, steps, this.#tree.config()))
		if (!plan) return false
		return this.#tx.applyRange(plan.window, plan.text)
	}

	/**
	 * WOULD A ROW NESTED UNDER `parent` STILL BE ON SCREEN? THE one question every gesture that
	 * deepens a row has to ask, and it is asked of the DESTINATION — `null` is the root, which
	 * always paints.
	 *
	 * A caret may not enter a subtree with no boxes, and two gestures put it there. Tab: a row
	 * opened after a closed toggle's title and then indented landed inside it, where eleven
	 * characters were typed into the document with no visible caret and nothing on screen. The
	 * DROP: released one indent step right of a heading's line, a row was written as that heading's
	 * first child, and the heading's component takes the child rows it is handed and paints none of
	 * them — the row kept its text, lost its box, and the document read one root shorter. Refusing
	 * the MOVE rather than recovering the caret afterwards is the answer that loses nothing: the row
	 * stays where the user can see it, and the gesture is still consumed, exactly as it is at a
	 * depth the scan refuses.
	 *
	 * IT USED TO BE ASKED OF THE PARENT'S FIRST EXISTING CHILD, which a parent with no children yet
	 * could not answer, so the move was allowed and that was the whole of the drop defect above. It
	 * is now {@link DomModel.nestingIsPainted}, which asks the parent's own child-rows host — a fact
	 * every kind has whether or not it has children yet.
	 */
	#nestingIsPainted(parent: RowNode | null): boolean {
		return parent === null || this.#dom.nestingIsPainted(parent.id)
	}

	/**
	 * The row that would PARENT `node` one level deeper: its previous sibling, because nesting is
	 * indentation and nothing else. `null` where it has none — the plan refuses that on its own.
	 */
	#parentOneLevelDeeper(node: RowNode): RowNode | null {
		const rows = untracked(() => preorderRows(this.#tree.roots()))
		const at = rows.findIndex(entry => entry.row === node)
		if (at < 0) return null
		const depth = rows[at].depth
		for (let index = at - 1; index >= 0 && rows[index].depth >= depth; index--) {
			if (rows[index].depth === depth) return rows[index].row
		}
		return null
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
	 * THE row parse policy: how the row skeleton is carved, or `undefined` for a document
	 * that has no rows. There is no mode beside it (ADR-0011) — every row question in core asks
	 * this, or the tree it produced.
	 *
	 * PROPS-derived, deliberately not tree-derived. `SlotsFeature.containerProps` reads it
	 * during SERVER rendering, where no container has attached and the tree is therefore still
	 * empty, so a tree-derived answer would drop the grip gutter from the SSR pass.
	 *
	 * A NULL `separator` ANSWERS `undefined`: the value never splits, which is one document with
	 * no rows — the row parse, the row-controls gates, the grip gutter and `RowController` all
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

	/**
	 * The caret to its LINE's edge — Home and End; the primitive is
	 * {@link DomModel.moveToLineBoundary} and the correction below is this layer's.
	 *
	 * A CARVED ROW IS ONE LINE (ADR-0011), AND THE BROWSER DOES NOT KNOW THAT. `lineboundary` is a
	 * question about BOXES, and a kind that carves its body paints each piece in a box of its own —
	 * so Home in the second column of a table answered that column's start, which is a position no
	 * line of this document begins at. MEASURED on `'|= A | B⏎| c | d'` with the caret in the
	 * header's `B`: Home stopped at `B`, and the Enter after it emitted `'|= A | ⏎| B⏎| c | d'` —
	 * the header lost a column and the column became a data row, from two keys with no selection
	 * anywhere. It is round seven's row-start rule reached by a different trigger: the split itself
	 * is correct for the position it was given, and the position was the browser's.
	 *
	 * ONLY IN A CARVED PIECE, checked rather than assumed, so wrapped prose keeps the browser's own
	 * answer — a row that wraps over three visual lines still has three line edges and they are the
	 * platform's to find. The declared cost is the other half of that: a carved piece whose own text
	 * wraps has its wrapped edges taken by the LINE too, because the piece is not a line.
	 */
	moveToLineBoundary(direction: 'backward' | 'forward', extend: boolean): boolean {
		if (!this.#dom.moveToLineBoundary(direction, extend)) return false
		const anchors = this.domAnchors()
		// The END the key MOVED, which under `extend` is the only one it touched: a DOM Range is
		// document-ordered, so backward moved the low end and forward the high one.
		const moved = anchors && (direction === 'backward' ? anchors.anchor : anchors.head)
		if (!moved || !this.rowOf(moved)?.cell) return true
		// Asked of the END THAT MOVED, not of the pair: under `extend` the other end is wherever the
		// selection started, and `rowScope` reads the `anchor` it is handed.
		const span = this.rowScope({anchor: moved, head: moved}, 'row')
		if (!span) return true
		const edge = this.anchorAt(direction === 'backward' ? span.start : span.end)
		if (!extend) this.selection.select(edge)
		else if (direction === 'backward') this.selection.select(edge, anchors.head)
		else this.selection.select(anchors.anchor, edge)
		return true
	}

	/**
	 * Take focus back from a control of this editor's own; see {@link SelectionDriver.reclaimFocus}.
	 * The commit clock calls it for every control that edits the document; `RowController` calls it
	 * for the two gestures its GRIP ends without one — a cancelled drag and a refused menu verb.
	 */
	reclaimFocus(): void {
		this.#selectionDriver.reclaimFocus()
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
			claimRow: origin => this.#claimRow(origin),
			selectLine: () => this.selectLine(),
		})

		// THE DOM CLOCK, because where a caret MAY be is a question about the frame the framework
		// painted rather than about the tree.
		watch(this.#pipeline.bound, () => this.#afterFrame())
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

	/**
	 * The offset-space core of {@link replaceBetween}, shared with {@link replaceRows} — whose span
	 * is one no pair of anchors can express. Answers the post-edit caret, or `undefined` when the
	 * write was refused.
	 */
	#replaceWithin(start: number, end: number, text: string): NodeAnchor | undefined {
		const op = untracked(() => {
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
			// The same refusal Tab makes, at the other gesture that deepens a row — and HERE rather
			// than in `moveRows`, because this is where the drop and `RowNode.moveTo` meet.
			if (!this.#nestingIsPainted(placement.parent)) return false
			const plan = untracked(() => movePlan(this.#tree.roots(), nodes, placement, this.#tree.config()))
			// `'unchanged'` — the rows already hold that placement — writes nothing and answers
			// like a refusal, which is what a drop onto a row's own place has always looked like
			// from here. The two are separate in the plan so the DROP can offer that placement.
			if (!plan || plan === 'unchanged') return false
			return this.#tx.applyRange(plan.window, plan.text)
		},
		/**
		 * An ABSOLUTE depth, lowered onto the set verb's steps — which is arithmetic only this
		 * layer can do, since where the row is NOW is a pre-order fact and not one a caller holds.
		 * A row the walk cannot find is dead, and the lookup is that check.
		 */
		setDepth: (node, depth) => {
			this.#ensureSeeded()
			const at = untracked(() => preorderRows(this.#tree.roots()).find(entry => entry.row === node))
			return at !== undefined && this.indentRows([node], depth - at.depth)
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
		 *
		 * A SEEDED body is the one retype with no such anchor to move: there was no body to keep,
		 * so every position the mapping can answer is past what the kind supplied. The plan names
		 * the caret there and the splice carries it — which is a NAMED caret rather than
		 * {@link #applyCaret}, because that one is uncontrolled-only and this must hold in both
		 * modes. See {@link RowPatch.seeded}.
		 */
		turnInto: (node, option, patch) => {
			this.#ensureSeeded()
			const descriptor = option && untracked(() => this.#rowKind(option))
			if (option !== undefined && descriptor === undefined) return false
			const plan = untracked(() => turnIntoPlan(this.#tree.roots(), node, descriptor, patch))
			if (!plan) return false
			return this.#tx.applyRange(plan.window, plan.text, plan.caret)
		},
		/**
		 * A split PUTS A POSITION IN, so unlike a retype it moves the caret — into the row it
		 * produced, named by the pre-order index the plan answers. {@link splitPlan} forms that
		 * index because it is the one layer that may.
		 */
		splitAt: (node, at) => this.#commands.writeRows(node, {anchor: at, head: at}, ['', '']),
		/**
		 * The general form, and the one the split lowers onto: a cut with text written on both
		 * sides of it. The caret goes into the LAST row it opened, past what was written there —
		 * for the split's empty pieces that is the row's entry, which is where Enter has always
		 * left it — unless the plan names none, which is the markup clip's arm and leaves the
		 * caret to the window's own mapping.
		 */
		writeRows: (node, span, rows) => {
			this.#ensureSeeded()
			let written = false
			batch(() => {
				const plan = untracked(() =>
					splitPlan(
						this.#tree.roots(),
						node,
						span,
						this.#tree.config()?.separator,
						this.#continues(node),
						rows
					)
				)
				if (!plan) return
				if (!this.#tx.applyRange(plan.window, plan.text)) return
				written = true
				if (plan.into !== undefined) this.#enterRow(plan.tail, plan.into)
			})
			return written
		},
		/**
		 * The bytes are a LEAD and a SEPARATOR, and the order between them is the whole verb: an
		 * ordinary row's span already runs past its own separator, so the lead is written first and
		 * the separator ends the new line; the document-final row owns none, so the separator has to
		 * terminate IT before the lead can open anything. Both facts live here (ADR-0003), which is
		 * why "add below" is a verb rather than a string a caller splices.
		 *
		 * {@link #insertAfter} answers the caret AND the membership: a row it cannot name is not a row
		 * of the document, and the bytes formed here are meaningless for one. `lead()` and
		 * `endsDocument` are read before that refusal and are simply thrown away with it.
		 */
		addSibling: node => {
			const config = untracked(() => this.#tree.config())
			if (!config) return false
			const line = untracked(() => ({lead: node.lead(), final: endsDocument(this.#tree.roots(), node)}))
			return this.#insertAfter(node, line.final ? config.separator + line.lead : line.lead + config.separator)
		},
	}

	/** The compiled row kind an option declares, resolved by its MARKUP — see {@link Parser.rowKind}. */
	#rowKind(option: CoreOption): MarkupDescriptor | undefined {
		return this.#parser()?.rowKind(option.markup)
	}

	/**
	 * WHAT A ROW OPENED BESIDE THIS ONE IS WRITTEN AS — `RowSpec.continues` resolved against the
	 * compiled kinds, which is a question only this layer can answer: `tree/` holds descriptors and
	 * never the options that declared them.
	 *
	 * `true` is this row's own kind; an OPTION is that option's kind — a table header continues into
	 * a table LINE. An option this editor compiled no row kind from resolves to `undefined`, which
	 * is a plain row: the same refusal {@link TreeCommands.turnInto} makes for the same reason, and
	 * the only one a write path can make without a report per keystroke.
	 *
	 * THE KIND CONTINUES AND THE META DOES NOT, and that is the whole rule. A `meta` is the ROW's
	 * own field, not the kind's: `- [x] ` says THIS task is done, and Enter after it opened a
	 * second task already ticked. What the new row carries instead is the kind's own SEED —
	 * `menu.meta`, which is what a row of that kind starts as through every other door, so "a new
	 * to-do" means the same thing whether the `/` menu or Enter opened it. A kind whose meta really
	 * is part of the kind says so by seeding it: the showcase's callout seeds `warning` and gets a
	 * warning callout, where it used to copy the tone of the row above.
	 */
	#continues(node: RowNode): Continuation {
		const continues = this.rowSpec(node)?.continues
		if (!continues) return undefined
		const option = continues === true ? this.#optionOf(node) : continues
		const descriptor = continues === true ? node.descriptor() : untracked(() => this.#rowKind(continues))
		return {descriptor, meta: option?.menu?.meta}
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
	 *
	 * A ROW THE SEQUENCE DOES NOT NAME IS REFUSED, and the sequence lookup is where that question
	 * was already being answered — for the caret alone, which is how all three verbs above came to
	 * write anyway. A CARVED PIECE is the row it excludes: a cell answers `lead()` and
	 * `endsDocument` like any other row and both are meaningless for it, so anything spliced after
	 * one lands INSIDE a line — `'| a | b'` duplicated to `'| a| a | b'`, and an inserted separator
	 * cut the table row in two. An INLINE node is not refused and cannot be: when the document has
	 * rows the sequence holds only rows, so a mark is absent from it by construction and leaves the
	 * caret to adoption's repair, exactly as a nested node did before rows nested.
	 */
	#insertAfter(node: TreeNode, text: string): boolean {
		this.#ensureSeeded()
		let inserted = false
		batch(() => {
			const at = untracked(() => {
				const index = rowSequence(this.#tree.roots()).indexOf(node)
				return index < 0 ? undefined : index + (node.kind === 'row' ? preorderRows([node]).length : 1)
			})
			if (at === undefined && node.kind === 'row') return
			if (!this.#tx.applyAfter(node, text)) return
			inserted = true
			if (at !== undefined) this.#enterRow(at)
		})
		return inserted
	}

	/**
	 * Put the caret INTO {@link rowSequence}'s entry at `index` — {@link entryAnchor}'s one rule,
	 * applied after the splice so the row exists to be named. A no-op when no such entry came
	 * back, which is what controlled mode always looks like: the tree has not moved, so
	 * {@link #applyCaret} would decline anyway.
	 *
	 * `into` is how far past that entry the caret belongs, and it is an OFFSET rather than a walk
	 * because what was written there may parse into several nodes: a pasted clip carrying a markup
	 * arrives as text and a mark, and stepping `into` characters through the tree would have to
	 * re-derive the split. Zero is the entry itself, which is every caller but the paste.
	 *
	 * THE ZERO FORK IS NOT AN ECONOMY, measured: for a ROW the two arms agree everywhere — every row
	 * carries a text child, even an empty one, so `entryAnchor` never falls to `{before}` — but for
	 * a MARK entry they name different POSITIONS, and {@link rowSequence} falls back to the ROOTS in
	 * a document that parses no rows. `entryAnchor` lands inside the mark's slot; the offset arm
	 * lands on the text before its opener. Pinned in `markNode.spec.ts` ('names a position INSIDE
	 * the mark an insert lands on'), which is what a green suite could not tell: both arms project
	 * to the same OFFSET on the insert cases that already existed, so deleting the fork reddened
	 * nothing and only the next character typed says which position the caret held.
	 */
	#enterRow(index: number, into = 0): void {
		// `.at` for `entryAnchor`'s reason; a negative index cannot arrive here — every
		// caller derives it from a sequence index or a literal 0.
		const row = untracked(() => rowSequence(this.#tree.roots()).at(index))
		if (!row) return
		if (into === 0) {
			this.#applyCaret(entryAnchor(row))
			return
		}
		this.#applyCaret(
			this.anchorAt(untracked(() => (row.kind === 'row' ? row.slotRange().start : row.position.start)) + into)
		)
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

	/**
	 * THE CARET'S OWN INVARIANT: a caret may sit only where the document is PAINTED and EDITABLE.
	 *
	 * ONE reading for what were three defects, because they are one — an atomic row holds no caret
	 * position at all, a row inside a collapsed subtree holds one with no box, and a `contenteditable
	 * ="false"` control root holds one the browser will not edit. See {@link DomModel.reachable}
	 * for the refusals it rests on, and {@link #keepTailEnterable} for the invariant's other half.
	 *
	 * ON THE DOM CLOCK, and it has to be: the model clock pulses while the tree already holds a row
	 * the framework has not painted yet, so every reachability read there answers about the previous
	 * frame. Measured — the caret's own recovery skipped the row it had just opened.
	 *
	 * A RANGE is left alone: what is unreachable about a selection is a question nobody asked, and
	 * every gesture that makes one places its own ends.
	 */
	#afterFrame(): void {
		// ONE MICROTASK PAST THE PULSE, deduped — the invariant's settling point, and it buys three
		// things at once rather than being a scheduler for its own sake.
		//
		// THE FRAME IS WHOLE. This clock pulses per element REGISTRATION as well as per commit, so a
		// mid-patch pulse shows a row whose element the framework has already replaced and whose
		// children it has not yet reached. MEASURED in Vue: outdenting a row re-parents it, and for
		// one pulse the row was bound with its own text surface gone — read there, the invariant
		// declared the row unenterable and grew a trailing row on an ordinary Backspace.
		//
		// THE FRAMEWORK HAS RENDERED. Both adapters flush a controlled echo inside the gesture that
		// caused it, so a microtask queued from the pulse lands after that render.
		//
		// AND THE DISPATCHER IS OFF THE STACK. A verb called from inside a commit is a bug the
		// dispatcher throws on, and this clock is pulsed by the commit itself.
		if (this.#settling) return
		this.#settling = true
		queueMicrotask(() => {
			this.#settling = false
			// EVERY WRITE THE INVARIANT MAKES IS A REPAIR (see {@link EditRecord.repair}), and this
			// is the one place that can say so: both arms below open a row through the ordinary row
			// verbs, which a user drives too, so the fact is about the CALLER and not about the verb.
			// The flag is read synchronously inside `CommitSink.commit`, which the write reaches
			// before this call returns in either value mode.
			this.#repairing = true
			try {
				this.#settleRows()
				this.#settleCaret()
			} finally {
				this.#repairing = false
			}
			// AND THE FOCUS HALF, after the caret half and outside the repair flag: taking focus
			// back writes no bytes, so it is not an edit and must not be recorded as one. A commit
			// is the moment a CONTROL'S interaction has landed in the document — ticking a to-do,
			// choosing a fence's language, cycling a callout's tone are all one `turnInto` — and
			// after it the caret the user still holds has to be a caret again. See
			// {@link SelectionDriver.reclaimFocus}.
			this.#selectionDriver.reclaimFocus()
		})
	}

	#settling = false

	#repairing = false

	/**
	 * THE DOCUMENT HALF OF THE SAME INVARIANT: a row may not be left where nothing paints it.
	 *
	 * A kind that ignores the rows it is handed renders no host for them, so its children are in
	 * the value, absent from the DOM and reachable only by undo. `moveTo` and `indentRows` refuse
	 * to write a row there ({@link #nestingIsPainted}), but a row can BECOME such a parent without
	 * either verb running: `turnInto` retypes the row under its children — pick Heading 3 on a
	 * bulleted parent and both nested bullets leave the screen — and a paste or a replayed edit
	 * writes the same shape with no row named at all. Asking at each of those doors is how the same
	 * defect has now been repaired three times; this asks once, where the answer exists.
	 *
	 * AND IT CAN ONLY BE ASKED HERE. Whether a kind paints child rows is a DOM fact, and the
	 * destination kind of a retype has no DOM until the frame after it — so the check cannot
	 * precede the write, and the repair is a repair rather than a refusal: {@link EditRecord.repair}
	 * folds it into the edit that provoked it, so one undo takes back both.
	 *
	 * THE CHILDREN ARE LIFTED, not deleted and not put back: the retype is what the user asked for
	 * and it stands, and the rows that can no longer live under it move to the depth that paints
	 * them — the same verb, and the same step, a Shift+Tab would have made.
	 *
	 * ONLY WHILE SOMEONE IS IN THE DOCUMENT, for {@link #keepTailEnterable}'s reason: a value
	 * merely AUTHORED with a child under such a kind is the consumer's own bytes, and an editor
	 * that rewrote them on mount would emit an edit nobody made.
	 */
	#settleRows(): void {
		if (!this.selection.anchors()) return
		const orphaned = untracked(() => this.#parentHostingNothing(this.#tree.roots()))
		if (!orphaned) return
		// ONE ROW PER PASS, and no loop: the lift is a splice, so the tree the walk read is stale
		// the moment it lands. The next pulse re-reads it and finds the next one, which is also
		// what makes the pass terminate — every lift moves a subtree one level up, and depth 0
		// always paints.
		this.indentRows(
			untracked(() => orphaned.rows()),
			-1
		)
	}

	/**
	 * The FIRST row in document order whose child rows have nowhere to be painted, or `undefined`.
	 *
	 * Its own descent rather than a `find` over {@link preorderRows}, and that is measured: this
	 * runs on every commit, and the pre-order walk materialises one entry per row whether or not it
	 * has children — 0.110 ms against 0.043 ms at 1000 rows, on the microtask after a keystroke
	 * whose whole L6 cost is ~0.7 ms there. This descends only where there is something to descend
	 * into and allocates nothing.
	 *
	 * A CARVED row is skipped WITH its children: cells are that row's body, painted by its own
	 * component, and nothing may move them.
	 */
	#parentHostingNothing(nodes: readonly TreeNode[]): RowNode | undefined {
		for (const node of nodes) {
			if (node.kind !== 'row' || hasCells(node)) continue
			const children = node.rows()
			if (children.length === 0) continue
			if (!this.#dom.nestingIsHosted(node.id)) return node
			const found = this.#parentHostingNothing(children)
			if (found) return found
		}
		return undefined
	}

	#settleCaret(): void {
		const anchors = this.selection.anchors()
		if (!anchors || !anchorEquals(anchors.anchor, anchors.head)) return
		const row = this.rowOf(anchors.anchor)?.row
		if (!row) return
		// A CARET AFTER A RAW BODY IS NOT INSIDE IT, and `{after: row}` is the only anchor that can say
		// so — every other position in such a row is an offset in its text. The DOM cannot hold this
		// one: a row's boundary DESCENDS to its edge child ({@link DomModel.#entryOf}), which for a
		// closed body is the last character of the CODE, three characters behind the literal the user
		// just typed. MEASURED: type a fence, a line of code and the closing backticks, and the caret
		// lands at the end of the code — Chromium reads it back, `syncFromDom` stores it, and Enter
		// after it writes another line INSIDE the fence. Travel continues forward instead, which is
		// where a person who has just closed a block goes and what {@link #recoverCaret} answers.
		if (typeof anchors.anchor !== 'string' && 'after' in anchors.anchor && untracked(() => hasRawBody(row))) {
			this.#recoverCaret(row)
			return
		}
		// `'absent'` is the frame's own "not yet" and stands down — the next pulse asks again.
		// `'boxless'` is a VERDICT and goes straight to the recovery: the row is painted, its
		// element is in the document and it generates no box, which is what a collapsed subtree
		// does to the rows inside it. {@link DomModel.reachable} cannot tell that apart — it asks
		// about the SURFACE and a hidden one is still a surface — so a caret closed inside a toggle
		// read as reachable, the invariant declared it well, and the focus reclaim below handed it
		// back to a row nobody could see. Every keystroke after that edited invisible text.
		const paint = this.#dom.rowPaint(row.id)
		if (paint === 'absent') return
		// ASKED OF THE ROW'S OWN ENTRY, not of the anchor the caret happens to hold, and that is the
		// difference between a verdict and a race: a node the adapter has not painted YET makes any
		// single anchor unresolvable for a pulse or two — a mark just inserted, the empty text token
		// the parse leaves after it — while a row whose ENTRY cannot be reached is an atomic block,
		// which is a fact about the row and stays true. MEASURED: the anchor reading grew a trailing
		// row every time a mention was completed at the end of a document.
		if (paint === 'painted' && this.#dom.reachable(entryAnchor(row))) {
			this.#keepTailEnterable(row)
			return
		}
		this.#recoverCaret(row)
	}

	/**
	 * THE INVARIANT'S OTHER HALF, and a TREE question rather than a DOM one: a document must end in
	 * a row the caret can LEAVE. A raw closed body — a fence, frontmatter — is the one row Enter
	 * cannot, because its interior already holds separators, so every Enter in it is a line; at the
	 * document's end that made the block a room with no door, where ArrowDown, Enter and a click
	 * below all failed to open a row after it.
	 *
	 * ONLY WITH THE CARET IN IT, so a document merely AUTHORED ending in a fence is left alone until
	 * someone actually stands in the trap. And once, by construction: the row this opens is the last
	 * row afterwards.
	 */
	#keepTailEnterable(row: RowNode): void {
		// O(1) ahead of everything else: almost no document ends in a raw body.
		if (!untracked(() => hasRawBody(row))) return
		if (untracked(() => preorderRows(this.#tree.roots()).at(-1)?.row) !== row) return
		this.#openRowAfter(row)
	}

	/**
	 * A GESTURE LANDED ON A ROW'S FROZEN PRESENTATION — the row it landed in is the row it gets,
	 * at that row's own entry. NEVER A NEIGHBOUR: a pointer names a place on the screen, so the one
	 * answer a claim may not give is a different row, which is exactly what routing this through
	 * {@link #recoverCaret} did — its search starts AFTER the row it is given, because it answers
	 * the other question (see there).
	 *
	 * AND WHEN THE ROW HOLDS NO POSITION AT ALL — an atomic kind paints none of its text, so there
	 * is nothing in it to put a caret on — THE ROW IS SELECTED. That is a change and it replaces the
	 * previous answer, which was to do nothing at all: inert reads to the user as the SAME defect
	 * with a different destination, because the click appears to do nothing and the next keystroke
	 * goes to wherever the caret was last, which is off screen. Measured 6 for 6 on the showcase —
	 * board card, metric number, properties chip, bookmark title, table-of-contents entry, board
	 * column head — with a caret established first.
	 *
	 * A SELECTION IS THE ONE ANSWER THIS EDITOR ALREADY OWNS. The row selection is the text
	 * selection read at row granularity (`RowController.selected`), so selecting a row is one
	 * `select` of its own span and every gesture over one already works: typing replaces it,
	 * Backspace takes it away, Esc widens to what it is nested in, Shift+arrows grow it, the grip
	 * drags it. It is also what the reference product does — a click on a non-text block selects
	 * the block.
	 *
	 * WHAT IT COSTS, declared: the browser paints nothing. A frozen row's own text has no surface,
	 * so `selectRange` finds no boundary for either end and the DOM selection stays where the click
	 * left it — the model holds the row and the screen does not say so. A consumer paints it from
	 * `store.rows.selected`, which is why that read is public; the showcase does not, and its
	 * `.blockSelected` rule is where it would.
	 *
	 * A CONTROL IN NO ROW AT ALL IS NOT THIS RULE'S BUSINESS, and that is the editor's own furniture:
	 * the grip and its menu are a control root parked over the document rather than inside a row, so
	 * a claim there has no row to name and the caret is whatever the verb that ran left behind.
	 *
	 * IT OUTRANKS EVERY READING THE GESTURE COULD NOT HAVE PRODUCED, and {@link #gestureCouldRead}
	 * is that test — the inversion of round nine's "a reading the model CAN make outranks a
	 * landing", which was backwards. Answers whether it took the gesture, so a caller that is
	 * declined runs the ordinary DOM sync it always did.
	 */
	#claimRow(origin: Node): boolean {
		const row = this.#rowAbove(origin)
		if (!row) return false
		if (this.#gestureCouldRead(row)) return false
		if (this.#placeInRow(row)) return true
		if (this.#selectRow(row)) return true
		this.#selectionDriver.restoreCaret()
		return true
	}

	/**
	 * COULD THE POINTER THAT LANDED IN `row` HAVE PRODUCED WHAT THE DOM SAYS RIGHT NOW — the whole
	 * of the precedence rule between a claim and a reading, and the one question that separates
	 * them.
	 *
	 * A pointer names a place on the SCREEN. Everything a press in `row` can leave behind touches
	 * that row: a caret it put there, and a sweep it began there and dragged away from — whose far
	 * end may be anywhere, but whose near end is where the finger went down. So a reading with an
	 * END in `row` is the gesture's own and stands, and a reading that names NEITHER end there —
	 * a caret three rows up that nothing has moved since, an anchor Chromium invented at the start
	 * of the editing host — is not one this gesture made, and the claim outranks it.
	 *
	 * A CARET IS NOT SUCH A READING AT ALL, whichever row it is in: it names no extent, so a claim
	 * loses nothing by outranking it. MEASURED, with a caret in the intro paragraph and one click on
	 * a board card: Chromium moves no caret for a mousedown on a `draggable`, the stale reading
	 * resolved perfectly well, and round nine's gates handed the next character to the paragraph —
	 * `'Apollo Ymoves the collaboration layer'`, three screens from the pointer.
	 *
	 * THE ROW, not the anchor: the two ends of a row selection are the row's OWN element edges and
	 * a click on frozen presentation lands on a descendant of it, so an identity test on anchors
	 * would answer no to the claim that wrote them.
	 */
	#gestureCouldRead(row: RowNode): boolean {
		const anchors = this.#selectionDriver.domAnchors()
		// A CARET IS NOT A SWEEP. Only an EXTENT is a thing a claim cannot re-derive; a collapsed
		// reading is the browser answering the same press this claim is about, and inside frozen
		// presentation it is `frozenBoundary`'s own answer — the row's entry, which would otherwise
		// read as "the gesture named this row" and decline the claim that produced it.
		if (!anchors || anchorEquals(anchors.anchor, anchors.head)) return false
		return this.rowOf(anchors.anchor)?.row === row || this.rowOf(anchors.head)?.row === row
	}

	/**
	 * THE ROW SELECTION OVER ONE ROW, written across the row's OWN ELEMENT: `{before}` to
	 * `{after}`.
	 *
	 * NOT `rowSpan`'s two offsets, which is what Esc's `'row'` rung writes, and the difference is
	 * the whole reason a click can answer at all. Those name positions in the row's TEXT, and a
	 * frozen row's text has no surface — `selectRange` finds no boundary for either end, so the
	 * DOM selection stays inside the frozen island where the click left it. Every input path then
	 * reads the DOM: `isConsumerOrigin` sees a control root and declines the event whole, so the
	 * row was selected in the model and every key after it did nothing. The row's own element IS
	 * registered, so its edges resolve, the browser paints the block, and the keys land.
	 *
	 * The two readings agree about WHICH ROW: an element's edges are `position.start`/
	 * `position.end`, which sit in the structural run at each end, and {@link contentSpan} is where
	 * they meet — it resolves both onto the row's own content.
	 *
	 * `false` for an editor with no rows at all, which is where the claim has nothing to select and
	 * the caret release is still the answer.
	 */
	#selectRow(row: RowNode): boolean {
		if (untracked(() => this.#tree.config()?.separator) === undefined) return false
		this.selection.select({before: row}, {after: row})
		return true
	}

	/**
	 * WHERE THE CARET GOES when the position it holds is one no caret may occupy: the nearest row
	 * entry AFTER it that is painted and editable, else a row opened after it when it ENDS the
	 * document, else the nearest entry before it.
	 *
	 * ITS QUESTION IS "WHERE NEXT", not "where did you point" — the row under the caret stopped
	 * being one a caret can hold (a collapse, a retype, a frame that unpainted it), so travel
	 * continues in the direction a person's own ArrowDown would. A POINTER asks the other question
	 * and takes {@link #claimRow}.
	 *
	 * FORWARD FIRST because that is where a person continues, and it is also what makes the opening
	 * arm terminate: the row it opens is reachable, so the next pass finds it by search rather than
	 * opening a second one — which is the pass controlled mode always needs, since a verb names no
	 * caret there.
	 *
	 * IT OPENS A ROW ONLY AT THE DOCUMENT'S END, which is where the invariant bites and — since the
	 * DOM clock also pulses per REGISTRATION, mid-patch — the one condition no half-painted frame
	 * can fake: it is read off the tree, not off the elements.
	 */
	#recoverCaret(from: RowNode): void {
		const rows = untracked(() => preorderRows(this.#tree.roots()).map(entry => entry.row))
		const at = rows.indexOf(from)
		for (let index = at + 1; index < rows.length; index++) {
			// The same three-way reading {@link #settleCaret} opens with, and it has to be the same
			// one. `'absent'` STOPS the walk: a row with no element is a row this frame has not
			// reached, and stepping past it would land the caret somewhere the user never pointed
			// at. `'boxless'` is STEPPED OVER — {@link #placeInRow} declines it — because a
			// collapsed subtree is exactly what a person's own ArrowDown skips: it is the row after
			// the whole collapsed run they land on, and stopping there would leave the caret in the
			// trap this was called to take it out of.
			if (this.#dom.rowPaint(rows[index].id) === 'absent') return
			if (this.#placeInRow(rows[index])) return
		}
		// A blank row of no kind is already a row the caret can enter — the trailing convention
		// (ADR-0009) leaves one at the end of any document ending in a separator — so the invariant
		// is met and opening a second one would grow the value on every pass.
		const blank = untracked(() => from.descriptor() === undefined && from.slot() === '')
		// AND NOT INSIDE A COLLAPSED ROOM: a sibling of a boxless row is boxless too, so opening one
		// there is a door nobody can see and a value that grows on every pass. The row the caret
		// leaves is found by the backward walk instead.
		const collapsed = this.#dom.rowPaint(from.id) === 'boxless'
		if (at === rows.length - 1 && !blank && !collapsed && this.#commands.addSibling(from)) return
		for (let index = at - 1; index >= 0; index--) {
			if (this.#placeInRow(rows[index])) return
		}
	}

	/**
	 * The caret at a row's own entry, when that entry is one it may occupy — which is ONE reading
	 * short of {@link DomModel.reachable}: a row generating no box holds a position the anchor
	 * space can name and no person can see, so the caret invariant may not put the caret back into
	 * one while recovering it from another.
	 */
	#placeInRow(row: RowNode): boolean {
		const anchor = untracked(() => entryAnchor(row))
		if (this.#dom.rowPaint(row.id) !== 'painted') return false
		if (!this.#dom.reachable(anchor)) return false
		this.#selectionDriver.placeAt(anchor)
		return true
	}

	/**
	 * A blank row after `row`, and NO CARET — which is the whole difference from
	 * {@link TreeCommands.addSibling} and the reason this is not that verb: the caret is INSIDE
	 * `row` and belongs there, the new row is the door it will need LATER. Moving it would take a
	 * user who just picked **Code** out of the fence they picked it for.
	 */
	#openRowAfter(row: RowNode): void {
		const config = untracked(() => this.#tree.config())
		if (!config) return
		// The document-final row owns no separator, so one has to terminate IT before the lead can
		// open anything — `addSibling`'s own rule for the final row, which this row always is.
		this.#tx.applyAfter(row, config.separator + row.lead())
	}

	/**
	 * The ROW a stranded DOM node sits in — the walk `DomModel.handleAt` cannot make, because it
	 * stops at the control root that stranded the caret in the first place.
	 */
	#rowAbove(origin: Node): RowNode | undefined {
		const handle = this.#dom.tokenAbove(origin)
		const node = handle && this.find(handle.id)
		return node?.kind === 'row' ? node : undefined
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
		repairing: () => this.#repairing,
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
 * A ROW markup answers to `rowMarkupError` as well, and to two rules no single markup can decide
 * alone — {@link shadowedRowKinds} is the second. Two kinds compiling to the same opener are
 * indistinguishable at a row's start, so the later one is dropped rather than shadowed silently.
 * A SPLIT answers to two more, both of which cost the kind its carve rather than its existence: a
 * delimiter has to be something (an empty one matches at every offset), and its target has to be a
 * row option of this editor.
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
	const kept = new Map<number, Markup>()
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
		kept.set(index, markup)
		return markup
	})
	for (const index of shadowedRowKinds(kept, openers)) result[index] = drop(index)
	return {markups: result, rows}
}

/**
 * The row kinds another kind's opener puts out of reach, by option index.
 *
 * A shared opener PREFIX is legal and load-bearing — longest-first is how `'- [x] '` is told from
 * `'- '` ({@link orderRowKinds}) — and it stops being legal the moment the LONGER opener belongs to
 * a kind that closes its own body. The scan lets a body gap cross separators, so such a kind claims
 * a row the shorter kind opened and then runs to a closing literal rows below, taking everything
 * between into a body no caret can enter. Measured: `'a⏎---! x⏎b⏎c⏎!---⏎e'` is six rows under
 * `'---__slot__'` alone and three once `'---!__value__!---'` is declared beside it, and the
 * showcase's own `'---\n__value__\n---'` beside its `'---__slot__'` divider took a page from 36
 * rows to 3.
 *
 * The CLOSED kind is the one that loses, whichever was declared first: dropping the shorter one
 * would leave the swallow in place, since the longer opener matches the same bytes with or without
 * it. That is where this parts company with the duplicate rule above, whose two kinds are
 * interchangeable and whose only tie-break is declaration order.
 *
 * Decided against ONE set of openers, so a drop cannot change another kind's verdict and the answer
 * cannot depend on the order the options arrive in.
 */
function shadowedRowKinds(kept: ReadonlyMap<number, Markup>, openers: ReadonlySet<string>): number[] {
	const shadowed: number[] = []
	for (const [index, markup] of kept) {
		const closer = rowCloser(markup)
		if (closer === undefined) continue
		const opener = rowOpener(markup)
		const shorter = [...openers].find(other => other.length < opener.length && opener.startsWith(other))
		if (shorter === undefined) continue
		reportBadProp(
			`Row opener "${opener}" in "${markup}" extends "${shorter}", which another row option claims, and ` +
				`this kind's body closes at "${closer}" rather than at the row's own end, so it would take the ` +
				'rows between. This option contributes no row kind.'
		)
		shadowed.push(index)
	}
	return shadowed
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