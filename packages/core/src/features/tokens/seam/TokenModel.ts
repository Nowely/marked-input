import type {DomRef} from '../../../shared/editorContracts'
import {batch, computed, signal, untracked, watch} from '../../../shared/signals/index.js'
import type {Computed, Event, Signal} from '../../../shared/signals/index.js'
import type {Host} from '../../state/Host'
import type {PropsModel} from '../../state/PropsModel'
import {createCommitPipeline} from '../dom/commit'
import type {TokenDelta} from '../dom/commit'
import {DomModel} from '../dom/DomModel'
import type {SelectionSnapshot} from '../dom/DomModel'
import {applyEditableState} from '../dom/editableState'
import {SelectionDriver} from '../dom/SelectionDriver'
import type {TokenHandle} from '../dom/TokenHandle'
import {Parser} from '../parser/Parser'
import {adjacentMark, anchorAt, offsetOfAnchor, stepAnchor} from '../tree/anchors'
import {gapWindow} from '../tree/gapWindow'
import {serializeMark} from '../tree/markPatch'
import {createSelection} from '../tree/selection'
import type {Selection} from '../tree/selection'
import {createTransactions} from '../tree/transactions'
import {createTokenTree, findNode, rootIndexOf, siblingOf, sliceNodes} from '../tree/tree'
import type {Anchors, MarkCommands, MarkNode, NodeAnchor, TextNode, TreeNode} from '../tree/types'
import {createBoundary} from '../tree/valueBoundary'

/**
 * The value owner (spec D1, plan decision D-c): it holds THE token tree, the
 * string boundary that decides commit policy, and the transaction verbs that write
 * it, and feeds each adoption result straight into the one commit pipeline.
 * Parsing belongs to the boundary and token identity to adoption; neither is this
 * class's business any more. Everything DOM-related — boundary math, selection
 * reads, caret placement — lives in {@link DomModel} and is delegated to here, so
 * consumers keep this single entry point. Owns the `nodes` map the pipeline mutates.
 *
 * It also OWNS THE SELECTION since S2.9 — {@link selection} (tree-space state) plus the
 * private {@link SelectionDriver} (its DOM I/O). `Store` used to construct both and hand
 * this class a two-method thunk back so the boundary could reach them, and that cycle was
 * the last thing forcing an explicit type annotation on two `Store` fields (TS7022).
 *
 * Mechanism ledger (spec §4.6). All eight are gone, and where each died is the point
 * of the record:
 *
 * 1. consume-once hint protocol (`#pendingEdit`/`takePendingEdit`) — S1.6a, with
 *    the write-path rewrite.
 * 2. heuristic per-edit diff (`tokenIdentity` + its two suites) — S1.6d.
 * 3. reparse-watch edit path — S1.6a: arrivals route explicitly through the
 *    boundary and no watch on the value survives in this layer.
 * 4. handle write latch / captured-token fallback — S1.6d: the mark verbs
 *    resolve the live node, which has no adopt→bind window.
 * 5. `#preferredHandle` + the selection clamp — S1.6c: the stored anchor's node
 *    is the disambiguator and an anchor cannot point past it.
 * 6. `removedIds()` — S1.6d: the `changed` payload carries the ids instead.
 *
 * 7. `TokenHandle#token` — the bind-generation latch (D9, plan decision D-h) — S2.7,
 *    the first half of Cut A. S2.6 had already taken its three positional readers; of
 *    the two left, {@link setEditable}'s kind test was dead (see there) and
 *    `commit.ts`'s divergence detector now compares against the live `TextNode.text()`.
 *    The DOM text it used to describe is written by one per-surface effect per bound
 *    text node, armed by `bind` and owned by the handle.
 *
 * 8. the compat SNAPSHOT — `current()`, the memo it was materialized through, and the
 *    `CommitInput` it was lowered into — S2.8, the second half of Cut A. The tree is the
 *    only representation left: both adapters render `TreeNode` off {@link nodes} and the
 *    pipeline takes the `TransactionResult` itself. `snapshot` survives as a TEST-ONLY
 *    oracle (`tree/__testing__/snapshot.ts`), which is the job it always did best.
 *
 * Layout: consumer reads → adapter SPI → engine SPI → wiring → internals.
 */
export class TokenModel {
	// ═══ Consumer reads ═══════════════════════════════════════════════════════

	/**
	 * THE model-level detector: fires once per commit, only after the DOM is
	 * consistent, carrying that commit's `{added, removed, updated}` ids (spec
	 * §2.3). Applies folded into one pending structural pass announce ONE merged
	 * delta — a consumer pruning off `removed` cannot miss a wave.
	 */
	get changed(): Event<TokenDelta> {
		return this.#pipeline.changed
	}

	/**
	 * Resolve a token id to its live handle, or `undefined`. The id-keyed read
	 * over the live node layer — fails closed while a structural apply awaits its
	 * bind (the layer is one generation stale, so a handle would let mutations act
	 * on a tree the DOM never showed). THE identity lookup: a consumer holding a
	 * render-tree token resolves `handle(token.id)` for MEASUREMENT and CARET
	 * commands, and the handle's existence IS the validity check. It carries no data
	 * of its own since S2.7 — content and positions are read from the node
	 * ({@link find}).
	 */
	handle(id: number): TokenHandle | undefined {
		if (this.#pipeline.pending()) return undefined
		return this.#nodes.get(id)
	}

	/**
	 * THE selection state (spec S2 D10): a pair of `NodeAnchor`s and their derivations,
	 * DOM-free. Its DOM half is the private {@link SelectionDriver} declared in the internals
	 * section, whose reads are exposed here as {@link domAnchors} / {@link focusFirst} /
	 * {@link placeAtHandle} / {@link isUserSelecting}.
	 *
	 * DECLARED HERE, above `#tree`, and the declaration-order hazard the design predicted for
	 * it was FALSIFIED rather than obeyed. The mechanism is real: probed in place, a field
	 * initializer that reads `this.#tree` from above the internals region answers `undefined`
	 * — silently, no throw and no type error. It does not reach this field because
	 * {@link createSelection} takes a dep BAG, and all three entries are CLOSURES evaluated at
	 * the first verb call, long after every initializer has run. Measured with the field
	 * declared first in the class: 1335 passed, unchanged, and a mounted store answers
	 * `isAllSelected` correctly. The DRIVER is the one with a real ordering constraint; see it.
	 */
	readonly selection: Selection = createSelection({
		// The bag exists so these three could be closures over `TokenModel`'s public reads
		// while `Store` still built the selection (S2.2); they are the model's own reads now,
		// which is the whole point of it. Two of them are NOT bare tree reads and cannot
		// become them:
		//
		// - {@link anchorAt} SEEDS (plan decision D-f). Substituting
		//   `anchorAt(this.#tree.roots(), offset)` fails `tree/selection.spec`'s "returns true
		//   when range spans the entire value" and `TokenModel.value.spec`'s companion — an
		//   unmaterialized tree has no roots, so every offset answers `'end'`.
		// - {@link value} is props-first, so `#tree.value()` disagrees with it exactly while a
		//   controlled parent's value is ahead of the last arrival. RECORDED GAP (measured):
		//   the substitution SURVIVES the whole suite — `isAllSelected` is the only consumer
		//   and no fixture reads it mid-flight, between a controlled emission and its echo.
		//   Kept props-first because that is what the pre-S2.9 wiring did, not because a test
		//   would notice.
		offsetOf: anchor => this.offsetOf(anchor),
		anchorAt: offset => this.anchorAt(offset),
		value: () => this.value(),
	})

	// ═══ Adapter SPI ══════════════════════════════════════════════════════════

	/**
	 * Renderer contract (adapter-only): bumped ⇔ the renderer must run. NOT a data read —
	 * the tree is {@link nodes}, and a mark component subscribes to its own node (spec D8).
	 * See {@link CommitPipeline.renderEpoch} for why `nodes` alone cannot carry this.
	 */
	get renderEpoch(): Computed<number> {
		return this.#pipeline.renderEpoch
	}

	/**
	 * Ref callback for a control element (e.g. overlay, drag handle). Registration is
	 * ELEMENT-ONLY: the sole reader is `#controlElements`, which feeds bind's
	 * `computeControlRoots` — a walk from each control up to the container. Nothing ever
	 * asks which token owns a control, which is why the `ownerPath` argument the six
	 * adapter call sites used to pass was write-only and went at S1.8 step 1.
	 */
	control(): DomRef {
		const key = `control:${++this.#nextControlId}`
		return element => {
			if (element) {
				this.#pendingControls.set(key, element)
			} else {
				this.#pendingControls.delete(key)
			}
		}
	}

	/**
	 * Ref callback for the element hosting a token's child sequence, keyed by the OWNER's
	 * stable id (S1.8 step 4). It was keyed by `TokenPath` until then; the id is the same
	 * thing bind already resolves per token, and it does not go stale when a sibling above
	 * the owner is added or removed mid-render.
	 */
	children(ownerId: number): DomRef {
		const key = `children:${++this.#nextChildSequenceId}`
		return element => {
			if (element) {
				this.#pendingChildSequences.set(key, {ownerId, element})
			} else {
				this.#pendingChildSequences.delete(key)
			}
		}
	}

	// ═══ Engine SPI (in-core consumers) ═══════════════════════════════════════

	/**
	 * THE value read (spec §4.4): controlled → the props value; uncontrolled → the
	 * last COMMITTED projection. There is no separate uncontrolled string — the tree
	 * IS the store; {@link TokenModel.value}'s three private inputs are declared
	 * together in the internals section below (`#seed`, `#seeded`, `#committed`).
	 *
	 * The `#seeded` arm is load-bearing and its gate is NOT the obvious one.
	 * Measured: reduced to `props.value() ?? this.#committed()`, the red case is
	 * `TokenModel.value.spec`'s "an unmounted store reads defaultValue before anything has
	 * committed" — it reads the value on an UNMOUNTED store, where nothing has
	 * committed yet and `#committed()` is `''`. That case exists BECAUSE S1.6c took
	 * the gate away from two selection cases (now in `tree/selection.spec`): `anchorAt`
	 * seeds (plan decision D-f), so every store that writes a selection is now seeded and
	 * survives the mutation. `TokenModel.value.spec`'s "initializes from defaultValue when
	 * uncontrolled" stays GREEN for a different reason: it mounts first, and the mount
	 * watch seeds the tree before the read.
	 */
	readonly value: Computed<string> = computed(
		() => this.props.value() ?? (this.#seeded() ? this.#committed() : this.#seed())
	)

	/**
	 * @internal THE text write (spec S2 §4.5): a cross-node replacement addressed by
	 * ANCHORS. The pair is normalized, so `from` after `to` is legal.
	 *
	 * Answers the CARET the edit's natural post-state wants — an anchor at the END of what
	 * was inserted, resolved against the POST-splice tree — or `undefined` when the write was
	 * refused. That is an answer and not a side effect because only this layer may form the
	 * offset it needs (`min(from, to) + text.length`); `EditController` applies it, and
	 * nothing above `tree/` forms a number. It is the whole reason the verb does not return a
	 * bare boolean.
	 *
	 * In CONTROLLED mode the tree has NOT moved — the commit emits and waits for the echo
	 * (spec D6) — so the anchor describes the pre-edit tree. `EditController` discards it
	 * there and `MarkputApi.replaceRange` reads it only as a success flag.
	 */
	replaceBetween(from: NodeAnchor, to: NodeAnchor, text: string): NodeAnchor | undefined {
		this.#ensureSeeded()
		// Lowered in the TREE's coordinate space: that is what `transactions.dispatch`
		// splices, and it equals {@link value} whenever seeded — in controlled mode the tree
		// holds the last arrival, and a mid-flight emission does not move it (spec D6).
		const op = untracked(() => {
			const roots = this.#tree.roots()
			const a = offsetOfAnchor(roots, from)
			const b = offsetOfAnchor(roots, to)
			const start = Math.min(a, b)
			const end = Math.max(a, b)
			const value = this.#tree.value()
			// WHOLE-VALUE ops are re-derived through `gapWindow` — the offset shim's rule
			// (spec D8), inlined here because this verb is its heir and S2.6 deletes it. A full
			// window makes both adoption walks inert and re-pairs every row BY INDEX, moving
			// `BlockController`'s per-row store onto the wrong row.
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
	 * `'end'` anchor is the last root's own end, so the span is the tree's own length by
	 * construction — the property the deleted `{start: 0, end: -1}` sentinel had, and the
	 * reason this is not `{0, value().length}` (that value is props-first in controlled mode).
	 */
	setValue(text: string): boolean {
		return this.replaceBetween('start', 'end', text) !== undefined
	}

	/**
	 * Spec S2 §4.5: the mark whose end (`-1`) or start (`+1`) coincides with `anchor`. THE
	 * adjacency test behind the Backspace/Delete mark swallow and `insertMark`'s post-splice
	 * lookup. The bare function is the module import — this method does not recurse.
	 */
	adjacentMark(anchor: NodeAnchor, direction: -1 | 1): MarkNode | undefined {
		return untracked(() => adjacentMark(this.#tree.roots(), anchor, direction))
	}

	/** Spec S2 §4.5: one character back (`-1`) or forward (`+1`). See {@link stepAnchor} for the fail-closed case. */
	step(anchor: NodeAnchor, direction: -1 | 1): NodeAnchor | undefined {
		return untracked(() => stepAnchor(this.#tree.roots(), anchor, direction))
	}

	/** The projection of the span between two anchors — {@link value} restricted to a window (see {@link sliceNodes}). */
	valueBetween(from: NodeAnchor, to: NodeAnchor): string {
		return untracked(() => sliceNodes(this.#tree.roots(), from, to))
	}

	/** @internal Whole-node replacement (spec D5) — the mark verbs' write path. */
	applyStructural(target: TreeNode, replacement: string): boolean {
		this.#ensureSeeded()
		return this.#tx.applyStructural(target, replacement)
	}

	/** Spec §2.3's `input.find`: resolve a stable id to its live node. */
	find(id: number): TreeNode | undefined {
		return untracked(() => findNode(this.#tree.roots(), id))
	}

	/**
	 * Spec §2.3's `input.nodes()`, and since S2.8 THE render read: the live root nodes.
	 * Deliberately does NOT seed, for {@link offsetOf}'s reason — it is a read, and seeding
	 * writes signals.
	 *
	 * A `Computed` field rather than a method, which is what lets an adapter SUBSCRIBE to
	 * it: `readSelected` calls a selector entry only when `isReactive` says so, and that
	 * test is the bound signal/computed name — a plain method reads as data and would be
	 * handed to the renderer uncalled.
	 */
	readonly nodes: Computed<readonly TreeNode[]> = computed(() => this.#tree.roots())

	/**
	 * @internal Spec §2.3's `replaceText`: node-local coordinates (spec D5).
	 *
	 * RECORDED GAP (measured): dropping `#ensureSeeded()` here and on {@link tx} survives the
	 * whole suite — every fixture reaches these verbs through a mounted store, which the mount
	 * watch already seeded. Kept for parity with {@link replaceBetween} and
	 * {@link applyStructural}, whose gates are the unmounted-store specs.
	 */
	applyText(node: TextNode, range: {start: number; end: number}, text: string): boolean {
		this.#ensureSeeded()
		return this.#tx.applyText(node, range, text)
	}

	/** @internal Spec §2.3's `input.tx` (spec D5's composition rules). */
	tx(fn: () => void): boolean {
		this.#ensureSeeded()
		return this.#tx.tx(fn)
	}

	/**
	 * The index of the ROOT whose subtree contains `id` — the block ROW index. Off the
	 * live tree, because the handle it would otherwise be read from carried a `#path`
	 * frozen at its last bind. A handle carries no data at all since S2.7, so the tree
	 * is not merely the fresher source, it is the only one.
	 */
	rootIndexOf(id: number): number | undefined {
		return untracked(() => rootIndexOf(this.#tree.roots(), id))
	}

	/** The node's previous (-1) or next (+1) sibling within its OWN parent's child list. */
	siblingOf(id: number, direction: -1 | 1): TreeNode | undefined {
		return untracked(() => siblingOf(this.#tree.roots(), id, direction))
	}

	/**
	 * Spec §2.3: a global offset → the node anchor at it (right affinity). THE
	 * offset→anchor direction for the selection write path.
	 *
	 * Seeds for the same reason the write verbs do (plan decision D-f): an
	 * unmaterialized tree has no roots, so every offset would answer `'end'`. The bare
	 * function is the module import — this method does not recurse.
	 */
	anchorAt(offset: number): NodeAnchor {
		this.#ensureSeeded()
		return untracked(() => anchorAt(this.#tree.roots(), offset))
	}

	/**
	 * An anchor's absolute offset in the tree's projection — the `tree/` boundary itself
	 * (spec S2 D1): the ONE place a coordinate is formed, and its callers are inside that
	 * layer (`Selection.isAllSelected`, `anchors.ts`'s adjacency and step). Deliberately
	 * does NOT seed — it is a READ reached from a computed's evaluation, and seeding writes
	 * signals.
	 *
	 * TREE space, not {@link value}: the two disagree exactly while a controlled parent's
	 * `props.value` is ahead of the last arrival, which is when the echo's capture runs.
	 * Its gate is `tree/selection.spec`'s "captures an 'end' anchor in TREE space,
	 * not against the props value", and that case has to be a DELETION — under an
	 * insertion the over-read and `map`'s shift both saturate onto the document end and
	 * the two readings agree by accident.
	 */
	offsetOf(anchor: NodeAnchor): number {
		return untracked(() => offsetOfAnchor(this.#tree.roots(), anchor))
	}

	/** Resolve a DOM node to its handle, 'control' if inside a control root, or undefined if outside the container. */
	handleAt(node: Node): TokenHandle | 'control' | undefined {
		return this.#dom.handleAt(node)
	}

	/**
	 * Map a DOM boundary (node, offset) to a node anchor in the LIVE tree.
	 *
	 * THE DOM→model direction of the selection sync (`SelectionDriver`'s `sync`), and
	 * the only production caller. The subscription guard lives at
	 * {@link DomModel.anchorFor}, the walk's own entry, so it holds for every
	 * caller rather than only this one.
	 */
	anchorFor(node: Node, offset: number, affinity?: 'before' | 'after'): NodeAnchor | undefined {
		return this.#dom.anchorFor(node, offset, affinity)
	}

	/**
	 * THE raw selection read: one snapshot of the live window selection (see
	 * {@link DomModel.selection}). Named `domSelection` since S2.9, when {@link selection}
	 * became the stored anchors — the `dom*` prefix is the same authority marker
	 * {@link domAnchors} carries.
	 */
	domSelection(): SelectionSnapshot | undefined {
		return this.#dom.selection()
	}

	/** DOM TRUTH as anchors (spec S2 D5): see {@link SelectionDriver.domAnchors}. */
	domAnchors(): Anchors | undefined {
		return this.#selectionDriver.domAnchors()
	}

	/** Move focus (and the caret) into the first root token; see {@link SelectionDriver.focusFirst}. */
	focusFirst(): void {
		this.#selectionDriver.focusFirst()
	}

	/** Place the caret at a bound handle's start/end; see {@link SelectionDriver.placeAtHandle}. */
	placeAtHandle(handle: TokenHandle, boundary: 'start' | 'end' = 'start'): boolean {
		return this.#selectionDriver.placeAtHandle(handle, boundary)
	}

	/** Mouse-sweep flag; the driver's editable policy reads it (see {@link setEditable}). */
	get isUserSelecting(): Signal<boolean> {
		return this.#selectionDriver.isUserSelecting
	}

	/** Current selection serialized for clipboard use. */
	selectedContent(): {html: string; text: string} | undefined {
		return this.#dom.selectedContent()
	}

	/** Place a collapsed caret at a node anchor (see {@link DomModel.placeCaret}). */
	placeCaret(anchor: NodeAnchor): boolean {
		return this.#dom.placeCaret(anchor)
	}

	/** Select between two node anchors, in either order (see {@link DomModel.selectRange}). */
	selectRange(anchor: NodeAnchor, head: NodeAnchor): boolean {
		return this.#dom.selectRange(anchor, head)
	}

	/**
	 * @internal Scoped editable-state application: conditional contentEditable
	 * on bound text surfaces, tabindex on bound mark roots, and the seed for
	 * future binds (replaces the old per-commit sweep). {@link SelectionDriver}
	 * owns the policy: it calls this whenever readOnly or isUserSelecting changes.
	 *
	 * The kind test this used to make off `handle.token()` was DEAD, which is why S2.7
	 * could delete the bind generation without replacing it: bind gives a `textElement`
	 * to text nodes and to nothing else (bind.ts's walk), so `!textElement` already
	 * implies a mark and the extra clause could never skip anything. Measured — deleting
	 * it before the token read went left the whole suite green.
	 */
	setEditable(options: {editable: boolean; readOnly: boolean}): void {
		this.#editable = {editable: options.editable, readOnly: options.readOnly}
		for (const handle of this.#pipeline.bound().values()) {
			const bindings = handle.node()
			if (!bindings) continue
			applyEditableState(bindings, options)
		}
	}

	// ═══ Wiring ═══════════════════════════════════════════════════════════════

	constructor(
		private readonly props: PropsModel,
		private readonly host: Host
	) {
		host.onMounted(() => {
			// Order matters: the immediate arrival seeds the pipeline (cold start is
			// a structural pass), so the immediate onRendered right after can bind
			// a pre-built DOM — the shell is live once the container attaches.
			//
			// ONE watch over the (value, parser, isBlock) tuple, exactly as the pre-cutover
			// shell had: a simultaneous props change is one wave and one commit, where three
			// separate watches would adopt (and announce) two or three times.
			//
			// RECORDED GAP (measured): splitting this into three watches SURVIVES the whole
			// core suite. Nothing anywhere counts `changed` for a value+parser or
			// value+layout change applied in ONE `props.set`, so the wave parity is
			// unobserved — the tuple is kept because the pre-cutover shell behaved that way,
			// not because a test would notice. A test would have to pin an announcement
			// count for a simultaneous props change; that is a contract nobody has stated,
			// so it is recorded rather than invented.
			watch(
				() => ({
					value: this.props.value(),
					parser: this.#parser(),
					isBlock: this.props.layout.isBlock(),
				}),
				(next, previous) => {
					if (previous && next.value === previous.value && this.#seeded()) {
						// Only the tokenization changed: re-derive from the unchanged projection.
						this.#boundary.reparse()
						return
					}
					// RECORDED, NOT FIXED (measured): the IMMEDIATE run has no `previous`, so it
					// always takes this arm — an uncontrolled edit made BEFORE mount is
					// discarded at mount (probe: `defaultValue: 'hello'`, unmounted
					// `replace({0,-1}, 'edited')` reads back 'edited', then mounting reads
					// 'hello', because `#restore` is only set on the controlled edge and the
					// re-arrival falls back to `#seed()`). No spec reaches it and no production
					// path can: edits originate from DOM events on a mounted container, and
					// `#ensureSeeded` exists for the specs that write to an unmounted store and
					// never mount it. Fixing it means seeding `#restore` from uncontrolled
					// commits too, which is S1.8's when this state moves.
					this.#onExternalValue(next.value)
				},
				{immediate: true}
			)
			watch(host.rendered, () => this.#pipeline.onRendered(), {immediate: true})
		})

		// LAST, so the driver's own `onMounted` runs after the arrival above — the order
		// `Store` produced while it built `tokens` before the selection. See
		// {@link TokenModel.#selectionDriver} for why this is not a field initializer.
		this.#selectionDriver = new SelectionDriver({
			selection: this.selection,
			host,
			readOnly: () => this.props.readOnly(),
			changed: this.#pipeline.changed,
			nodes: () => this.nodes(),
			find: id => this.find(id),
			handle: id => this.handle(id),
			handleAt: node => this.handleAt(node),
			domSelection: () => this.domSelection(),
			setEditable: options => this.setEditable(options),
			placeCaret: anchor => this.placeCaret(anchor),
			selectRange: (anchor, head) => this.selectRange(anchor, head),
			anchorFor: (node, offset, affinity) => this.anchorFor(node, offset, affinity),
		})
	}

	// ─── internals ─────────────────────────────────────────────────────────────

	readonly #parser: Computed<Parser | undefined> = computed(() => {
		const Mark = this.props.Mark()
		const options = this.props.options()
		const hasMark = Mark != null || options.some(opt => 'Mark' in opt && opt.Mark != null)
		if (!hasMark) return
		const markups = options.map(opt => opt.markup)
		if (!markups.some(Boolean)) return
		return new Parser(markups)
	})

	/** THE tree (spec D1), and since S2.8 the only representation of it. */
	readonly #tree = createTokenTree([], () => this.#markCommands)

	/**
	 * Spec §2.3's mark verbs, lowered onto `applyStructural` (spec D5). Read-only and
	 * dead-node gating live in the transaction layer, so both arms answer exactly what it
	 * answers — the deleted `MarkController` duplicated those two checks.
	 */
	readonly #markCommands: MarkCommands = {
		update: (node, patch) => this.applyStructural(node, serializeMark(node, patch)),
		remove: node => this.applyStructural(node, ''),
	}

	/**
	 * The lazily-materialized default — the pre-cutover value facade's `initial`, kept
	 * verbatim so a `defaultValue` set after the first read stays a no-op.
	 */
	readonly #seed = signal({initial: () => this.props.defaultValue() ?? ''})
	/**
	 * One-shot: the tree holds a value. A SIGNAL, not a plain flag — {@link value}
	 * routes on it, and a field would leave that computed permanently subscribed to
	 * `#seed` and blind to the first commit.
	 *
	 * Its named gates, measured as a plain field: `Store.spec`'s `internal state
	 * signals` › "update when written directly" and `current` › "returns written
	 * current value" / "reacts to current changes" — the three that write an unmounted
	 * store and read it back. The read BEFORE the write is what makes them
	 * discriminate: it caches the `#seed` arm and its dep set, and a plain field then
	 * changes nothing the computed subscribes to, so the read back is stale. Until
	 * S1.8 step 5 that read was implicit — `ValueModel.current` was a writable computed
	 * and `signal.ts`'s `writableComputed` evaluates its getter before the set to
	 * short-circuit an equal write; the token write verbs have no such read, so two of
	 * those cases now read the value explicitly first.
	 * `TokenModel.value.spec`'s "initializes from defaultValue when
	 * uncontrolled" stays green for the same reason it does under the {@link value}
	 * mutation above: mount seeds before the first read.
	 */
	readonly #seeded = signal({initial: false})
	/**
	 * The projection at the moment control was taken; where an uncontrolled fallback
	 * returns to. The pre-cutover signal did this implicitly by refusing to store
	 * while controlled, which froze its storage at the last uncontrolled write.
	 */
	#restore: string | undefined
	/**
	 * Edge detector for the uncontrolled→controlled transition. A field, not `watch`'s
	 * `previous`, so a container swap (which tears down and rebuilds the onMounted
	 * scope) cannot make a remount look like a fresh edge.
	 */
	#controlled = false
	/**
	 * The commit-generation marker: `join(tree)` as of the last COMPLETED commit,
	 * written by the boundary's `onResult` AFTER `pipeline.apply`. {@link value} reads
	 * this and never `#tree.value()` directly, because `adopt()` writes `tree.roots`
	 * inside its own `batch` whose flush would notify value subscribers while the
	 * token view is still stale — measured red against §4.4's consistency invariant
	 * (`seam/TokenModel.parse.spec.ts`'s "current() is updated when value.current
	 * fires"). Not a second store: one writer, and its content is the tree's own
	 * projection read at that instant, so drift is unrepresentable.
	 */
	readonly #committed = signal({initial: ''})

	readonly #boundary = createBoundary({
		tree: this.#tree,
		parser: () => this.#parser(),
		isBlock: () => this.props.layout.isBlock(),
		controlled: () => this.props.value() !== undefined,
		selection: () => this.selection.anchors(),
		onChange: next => this.props.onChange()?.(next),
		// Synchronous by contract (spec §4.4): the live tree must be consistent with
		// `value.current()` the moment adoption lands, because the value-slicing call sites
		// read positions off the nodes.
		//
		// ORDER IS LOAD-BEARING: `#committed` is written AFTER `pipeline.apply`, and it is
		// the only thing `value` depends on. Publishing it first (or letting `value` read
		// `#tree.value()`) hands subscribers a new string over a stale token view.
		//
		// ONE WAVE, and the `batch` is what makes that order OBSERVABLE rather than merely
		// written. `changed` is an event: emitted at batch depth 0 it flushes its subscribers
		// INSIDE `apply`, ahead of the two writes below it. Depth 0 is not the exotic case —
		// it is the whole controlled path, where adoption is driven from the props watch and
		// adoption's own batch has already closed by the time this runs; the uncontrolled path
		// was covered only incidentally, by `EditController.replace` wrapping the edit.
		// Measured on the uncovered one: typing '@' at offset 3 announced `changed` with the
		// stored caret still at 3 while the tree already read '@' with the caret at 4, so every
		// consumer of the announcement — the driver's caret re-place, the overlay's trigger
		// probe — saw the new tree against the previous generation's selection.
		onResult: result =>
			batch(() => {
				this.#pipeline.apply(result)
				this.#committed(this.#tree.value())
				// LAST, and inside the commit: the repair writes the selection the driver's
				// anchors watch then applies, and an imperative post-edit caret (`EditController`)
				// lands later in the same batch and wins by design (plan decision D-d).
				this.selection.repair(result)
			}),
	})

	readonly #tx = createTransactions({
		tree: this.#tree,
		readOnly: () => this.props.readOnly(),
		sink: this.#boundary.sink,
	})

	#arrive(value: string): void {
		this.#seeded(true)
		this.#boundary.arrive(value)
	}

	/** One router for every external value: the props watch, and `#ensureSeeded`. */
	#onExternalValue(value: string | undefined): void {
		const controlled = value !== undefined
		// Entering controlled mode freezes where an uncontrolled fallback returns to —
		// the pre-cutover signal did this implicitly by refusing to store while
		// controlled. The two arms are pinned separately: never-uncontrolled falls back
		// to the seed, an uncontrolled edit first falls back to that edit.
		if (controlled && !this.#controlled) this.#restore = this.#seeded() ? this.#tree.value() : undefined
		this.#controlled = controlled
		this.#arrive(value ?? this.#restore ?? this.#seed())
	}

	/**
	 * The tree's materialization point. The pre-cutover value was a lazily-initialized
	 * signal that worked on an UNMOUNTED store; several specs still edit one, so the
	 * write path materializes the tree on first use rather than waiting for mount.
	 *
	 * RECORDED, NOT WRAPPED: these reads are TRACKED, where every other read on this
	 * write path is `untracked` (see {@link replaceBetween}, and `arrive`/`reparse` in the
	 * boundary). Measured cost of the inconsistency — an effect that calls a write verb
	 * on an UNSEEDED store subscribes to `props.value` and `#seeded` and re-runs once
	 * when the parent later sets a value (1 → 2 runs); on a seeded store it subscribes
	 * to `#seeded` alone, which never flips again (1 → 1). So the blast radius is one
	 * spurious re-run of a reactive writer, and no production caller is reactive: edits
	 * originate from DOM events. The fix is one `untracked` around this body; it is
	 * deferred to S1.8, which moves this state and can gate the change instead of
	 * shipping an untested reactivity edit inside a hardening pass.
	 */
	#ensureSeeded(): void {
		if (this.#seeded()) return
		this.#onExternalValue(this.props.value())
	}

	/** THE live node layer, keyed by stable token id — mutated only through the pipeline. */
	readonly #nodes = new Map<number, TokenHandle>()

	readonly #pipeline = createCommitPipeline({
		container: () => this.host.container(),
		nodes: this.#nodes,
		roots: () => this.#tree.roots(),
		editableState: () => this.#editableState(),
		controlElements: () => this.#controlElements(),
		childSequenceHostsFor: ownerId => this.#childSequenceHostsFor(ownerId),
		isBlock: () => this.props.layout.isBlock(),
	})

	// All DOM-related reads/commands live in DomModel; the public methods above
	// are one-line delegations so consumers keep a single entry point (this
	// class). The deps are private closures over the pipeline: nothing DOM-shaped
	// leaks.
	readonly #dom = new DomModel({
		container: () => this.host.container(),
		byElement: element => this.#pipeline.byElement(element),
		isControlRoot: element => this.#pipeline.isControlRoot(element),
		roots: () => this.nodes(),
		find: id => this.find(id),
		handle: id => this.handle(id),
	})

	/**
	 * The selection's DOM half (spec S2 D10): listeners, caret application, the mouse-sweep
	 * flag and the editable policy over {@link selection}'s state. Private — its four reads
	 * are delegated in the engine SPI above, the same way `#dom`'s are.
	 *
	 * BUILT IN THE CONSTRUCTOR, not as a field initializer, and both halves of that are
	 * measured. `SelectionDriverDeps` takes `host` and `changed` as VALUES (the driver
	 * subscribes in its own constructor), so an initializer would read `this.host` — a
	 * parameter property, which `tsc` rejects with TS2729 — and `this.#pipeline`, which
	 * answers `undefined` from any initializer declared above it, silently. The constructor
	 * body has neither problem, and it puts the driver's `onMounted` AFTER this class's own,
	 * which is the order `Store` produced before S2.9.
	 */
	readonly #selectionDriver: SelectionDriver

	// Ref registries — populated by framework ref callbacks, read by bind.
	readonly #pendingControls = new Map<string, HTMLElement>()
	readonly #pendingChildSequences = new Map<string, ChildSequenceRegistration>()
	#nextControlId = 0
	#nextChildSequenceId = 0

	#controlElements(): ReadonlySet<HTMLElement> {
		return new Set(this.#pendingControls.values())
	}

	/** An unregistered id matches no registration, so the loop answers `[]` without a branch. */
	#childSequenceHostsFor(ownerId: number): HTMLElement[] {
		const out: HTMLElement[] = []
		for (const registration of this.#pendingChildSequences.values()) {
			if (registration.ownerId === ownerId) out.push(registration.element)
		}
		return out
	}

	/** Last state written by {@link setEditable}; until then derived from props at bind time. */
	#editable: {editable: boolean; readOnly: boolean} | undefined

	#editableState(): {editable: boolean; readOnly: boolean} {
		if (this.#editable) return this.#editable
		const readOnly = this.props.readOnly()
		return {editable: !readOnly, readOnly}
	}
}

type ChildSequenceRegistration = {
	readonly ownerId: number
	readonly element: HTMLElement
}