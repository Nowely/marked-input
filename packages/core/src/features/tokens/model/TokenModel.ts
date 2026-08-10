import type {DomRef, Range} from '../../../shared/editorContracts'
import {computed, signal, untracked, watch} from '../../../shared/signals/index.js'
import type {Computed, Event} from '../../../shared/signals/index.js'
import type {Host} from '../../state/Host'
import type {PropsModel} from '../../state/PropsModel'
import {createCommitPipeline} from '../dom/commit'
import {DomModel} from '../dom/DomModel'
import type {SelectionSnapshot} from '../dom/DomModel'
import {applyEditableState} from '../dom/editableState'
import type {TokenHandle} from '../dom/TokenHandle'
import {Parser} from '../parser/Parser'
import type {MarkToken, Token} from '../parser/types'
import {anchorAt, offsetOfAnchor} from '../tree/anchors'
import {serializeMark} from '../tree/markPatch'
import {lowerReplace} from '../tree/offsetShim'
import {createSnapshotMemo} from '../tree/snapshotMemo'
import {createTransactions} from '../tree/transactions'
import {createTokenTree, findNode, rootIndexOf, siblingOf} from '../tree/tree'
import type {MarkCommands, MarkNode, NodeAnchor, TextNode, TransactionResult, TreeNode} from '../tree/types'
import {createBoundary} from '../tree/valueBoundary'
import type {TokenDelta} from './commitInput'
import {fromTransaction} from './treeInput'

/**
 * The selection's two ends of the D7 protocol. A THUNK in `Store` because `tokens` is
 * built before `selection`; invoked only at commit/arrival time, never during
 * construction.
 */
export interface SelectionPort {
	/** Pre-adoption capture (spec D7), in the TREE's coordinate space. */
	range(): Range | undefined
	/** Post-adoption repair (spec D7): consumes `selectionBefore` + `map`. */
	repair(result: TransactionResult): void
}

/**
 * The value owner (spec D1, plan decision D-c): it holds THE token tree, the
 * string boundary that decides commit policy, the transaction verbs that write
 * it, and the snapshot memo — and feeds the one commit pipeline through
 * {@link fromTransaction}. Parsing belongs to the boundary and token identity to
 * adoption; neither is this class's business any more. Everything DOM-related —
 * boundary math, selection reads, caret placement — lives in {@link DomModel}
 * and is delegated to here, so consumers keep this single entry point. Owns the
 * `nodes` map the pipeline mutates.
 *
 * Mechanism ledger (spec §4.6) — CLOSED at S1.6d. All six are gone, and where
 * each died is the point of the record:
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
 * What deliberately SURVIVES, each with its reason:
 * - `TokenHandle#token` — D9's read latch (plan decision D-h). Five production
 *   readers want the BIND generation, three of them positional: `DomModel` →
 *   `dom/domBoundary.ts` (type, position, content), `commit.ts`'s divergence
 *   detector (content), {@link setEditable} (type) and `keyboard/arrowNav.ts`
 *   (position). Narrowing it to `{start, end}` would move the boundary layer's
 *   type/content reads onto the live tree — a DOM-layer refactor no item asks for.
 * - the internal offset shim ({@link replace}) — spec D8, gated on the block-rows
 *   follow-up that would give callers a node-shaped write verb.
 *
 * Layout: consumer reads → adapter SPI → engine SPI → wiring → internals.
 */
export class TokenModel {
	// ═══ Consumer reads ═══════════════════════════════════════════════════════

	/**
	 * THE consumer read: the latest reconciled tree, always fresh and consistent
	 * with `value.current()` (the parallel: `value.current()` is the string,
	 * `tokens.current()` is its parsed tree). Unlike `renderTree` (the renderer
	 * signal, which keeps its reference across text-path commits), `current()` is
	 * the pipeline's private `latest` — reassigned at the top of every apply, fresh
	 * in the pending window too. The boundary facade and every value-slicing
	 * consumer read it.
	 */
	current(): readonly Token[] {
		return this.#pipeline.current()
	}

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
	 * render-tree token resolves `handle(token.id)`; the handle's `token()` carries
	 * current content and positions, and its existence IS the validity check.
	 */
	handle(id: number): TokenHandle | undefined {
		if (this.#pipeline.pending()) return undefined
		return this.#nodes.get(id)
	}

	/** The live handle for a render-tree token, or undefined (no id / mid-window / dead). */
	handleOf(token: Token | undefined): TokenHandle | undefined {
		return token?.id === undefined ? undefined : this.handle(token.id)
	}

	// ═══ Adapter SPI ══════════════════════════════════════════════════════════

	/** Renderer contract (adapter-only): reference change ⇔ the renderer must run. NOT a consumer data read — use `current()`. */
	get renderTree(): Computed<Token[]> {
		return this.#pipeline.renderTree
	}

	/**
	 * Adapter SPI: the framework key of a render-tree token — its stable identity
	 * id. Every token an adapter renders comes from the reconciled tree, so the id
	 * is always present (bind.ts throws loud otherwise). Arrow property: adapters
	 * pass it around unbound.
	 */
	readonly keyOf = (token: Token): number => {
		if (token.id === undefined) throw new Error('keyOf: token has no id — must come from the reconciled tree')
		return token.id
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
	 * the gate away from two `SelectionController.spec` cases: `anchorAt` seeds (plan
	 * decision D-f), so every store that writes a selection is now seeded and survives
	 * the mutation. `TokenModel.value.spec`'s "initializes from defaultValue when
	 * uncontrolled" stays GREEN for a different reason: it mounts first, and the mount
	 * watch seeds the tree before the read.
	 */
	readonly value: Computed<string> = computed(
		() => this.props.value() ?? (this.#seeded() ? this.#committed() : this.#seed())
	)

	/**
	 * @internal The internal offset shim (spec D8): a global range → `applyRange`.
	 * THE write entry for every offset-speaking caller. `ValueModel` was a one-line
	 * delegation to it until S1.8 step 5 deleted the facade.
	 */
	replace(range: Range, replacement: string): boolean {
		this.#ensureSeeded()
		// The op must be lowered in the TREE's coordinate space — that is what
		// `transactions.dispatch` splices. It equals `value()` whenever seeded: in
		// controlled mode the tree holds the last arrival, and a mid-flight emission does
		// not move it (spec D6).
		const op = lowerReplace(
			untracked(() => this.#tree.value()),
			range,
			replacement
		)
		if (!op) return false
		return this.#tx.applyRange(op.window, op.text)
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
	 * Spec §2.3's `input.nodes()`: the live root nodes. REACTIVE — `roots` is a signal, so a
	 * consumer inside an effect re-runs on every structural change. Deliberately does NOT
	 * seed, for {@link offsetOf}'s reason: it is a read, and seeding writes signals.
	 */
	nodes(): readonly TreeNode[] {
		return this.#tree.roots()
	}

	/**
	 * @internal Spec §2.3's `replaceText`: node-local coordinates (spec D5).
	 *
	 * RECORDED GAP (measured): dropping `#ensureSeeded()` here and on {@link tx} survives the
	 * whole suite — every fixture reaches these verbs through a mounted store, which the mount
	 * watch already seeded. Kept for parity with {@link replace} and {@link applyStructural},
	 * whose gates are the unmounted-store specs.
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
	 * Spec §2.3's `useMark()` resolution: the live node behind a render-tree mark token.
	 *
	 * STRICT, and that is measured rather than assumed: every token an adapter renders comes
	 * from a tree published by `commitStructural`, so `find(token.id)` cannot miss. A tolerant
	 * variant — the pre-S1.7 `MarkController` returned `''` for a mark that had left the tree
	 * — was tried first and the whole suite stayed green either way, so the fallback would
	 * have been an untested guard AGENTS.md tells you not to keep.
	 *
	 * RECORDED GAP: by the same token nothing exercises the throw, so returning a bogus node
	 * instead of throwing also survives the suite. The error path is unfalsifiable here — it
	 * would take a React interleaving that re-renders a mark component after its node died,
	 * which no test can construct.
	 */
	markFor(token: MarkToken): MarkNode {
		const node = token.id === undefined ? undefined : this.find(token.id)
		if (node?.kind !== 'mark') throw new Error(`markFor: no live mark node for token #${token.id}`)
		return node
	}

	/**
	 * The index of the ROOT whose subtree contains `id` — the block ROW index. Off the
	 * live tree, because a handle's `#path` is bind-generation state on an object reused
	 * across binds and could answer from a stale generation.
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
	 * Seeds for the same reason {@link replace} does (plan decision D-f): an
	 * unmaterialized tree has no roots, so every offset would answer `'end'`. The bare
	 * function is the module import — this method does not recurse.
	 */
	anchorAt(offset: number): NodeAnchor {
		this.#ensureSeeded()
		return untracked(() => anchorAt(this.#tree.roots(), offset))
	}

	/**
	 * Spec §2.3's `selectionRange` half: an anchor's absolute offset in the tree's
	 * projection. Deliberately does NOT seed — it is a READ reached from
	 * `SelectionController.range`'s computed, and seeding inside a computed evaluation
	 * would write signals during evaluation.
	 *
	 * TREE space, not {@link value}: the two disagree exactly while a controlled parent's
	 * `props.value` is ahead of the last arrival, which is when the echo's capture runs.
	 * Its gate is `SelectionController.spec`'s "captures an 'end' anchor in TREE space,
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

	/** Map a DOM boundary (node, offset) to an absolute document position. */
	boundaryFor(node: Node, offset: number, affinity?: 'before' | 'after'): number | undefined {
		return this.#dom.boundaryFor(node, offset, affinity)
	}

	/** THE selection read: one snapshot of the live window selection (see {@link DomModel.selection}). */
	selection(): SelectionSnapshot | undefined {
		return this.#dom.selection()
	}

	/** Current selection serialized for clipboard use. */
	selectedContent(): {html: string; text: string} | undefined {
		return this.#dom.selectedContent()
	}

	/** Place a collapsed caret at an absolute document position. */
	placeCaret(rawPosition: number): boolean {
		return this.#dom.placeCaret(rawPosition)
	}

	/** Select [start, end]; collapses via placeCaret when equal. */
	selectRange(start: number, end: number): boolean {
		return this.#dom.selectRange(start, end)
	}

	/**
	 * @internal Scoped editable-state application: conditional contentEditable
	 * on bound text surfaces, tabindex on bound mark roots, and the seed for
	 * future binds (replaces the old per-commit sweep). SelectionController
	 * owns the policy: it calls this whenever readOnly or isUserSelecting changes.
	 */
	setEditable(options: {editable: boolean; readOnly: boolean}): void {
		this.#editable = {editable: options.editable, readOnly: options.readOnly}
		for (const handle of this.#pipeline.bound().values()) {
			const bindings = handle.node()
			if (!bindings) continue
			if (!bindings.textElement && handle.token().type !== 'mark') continue
			applyEditableState(bindings, options)
		}
	}

	// ═══ Wiring ═══════════════════════════════════════════════════════════════

	constructor(
		private readonly props: PropsModel,
		private readonly host: Host,
		/**
		 * Both ends of the D7 selection protocol ({@link SelectionPort}), injected because
		 * `Store` builds `tokens` before `selection`. Invoked only from the boundary's
		 * `fold` and `onResult`, i.e. at commit/arrival time — never during construction.
		 *
		 * NAMED `selectionPort`, not `selection`: this class already has a
		 * `selection(): SelectionSnapshot | undefined` Engine SPI method. Measured with
		 * the colliding name: TS2300 (duplicate identifier), TS2403 / TS2687 on the two
		 * declarations, TS2532 / TS2339 at the two call sites, and TS2741 in `Store.ts`.
		 * The task does not compile.
		 */
		private readonly selectionPort: () => SelectionPort
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

	/**
	 * THE tree (spec D1). Paired for life with `#memo` — `fromTransaction` reads the
	 * roots from OUTSIDE the result, so the two must describe the same tree. Both are
	 * readonly fields of this instance, declared adjacently, never reassigned, and
	 * `#boundary`'s `onResult` is their only caller: the pairing is guaranteed by
	 * construction, which is why no test gates it (plan decision D-h).
	 */
	readonly #tree = createTokenTree([], () => this.#markCommands)
	readonly #memo = createSnapshotMemo()

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
	 * short-circuit an equal write; `tokens.replace` has no such read, so two of those
	 * cases now read the value explicitly first.
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
	 * (`features/tokens/TokenModel.spec.ts`'s "current() is updated when value.current
	 * fires"). Not a second store: one writer, and its content is the tree's own
	 * projection read at that instant, so drift is unrepresentable.
	 */
	readonly #committed = signal({initial: ''})

	readonly #boundary = createBoundary({
		tree: this.#tree,
		parser: () => this.#parser(),
		isBlock: () => this.props.layout.isBlock(),
		controlled: () => this.props.value() !== undefined,
		selection: () => this.selectionPort().range(),
		onChange: next => this.props.onChange()?.(next),
		// Synchronous by contract (spec §4.4): `tokens.current()` must be consistent with
		// `value.current()` the moment adoption lands, because seven call sites slice the
		// value by positions read from the snapshot.
		//
		// ORDER IS LOAD-BEARING: `#committed` is written AFTER `pipeline.apply`, and it is
		// the only thing `value` depends on. Publishing it first (or letting `value` read
		// `#tree.value()`) hands subscribers a new string over a stale token view.
		onResult: result => {
			this.#pipeline.apply(fromTransaction(result, this.#memo, this.#tree.roots()))
			this.#committed(this.#tree.value())
			// LAST, and inside the commit: the repair writes the selection the `#anchors`
			// watch then applies, and an imperative post-edit caret (`EditController`) lands
			// later in the same batch and wins by design (plan decision D-d).
			this.selectionPort().repair(result)
		},
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
	 * write path is `untracked` (see {@link replace}, and `arrive`/`reparse` in the
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
		// Every snapshot token carries its node's id (`tree/snapshot.ts`), so the
		// pipeline never has to ask an allocator.
		idFor: token => token.id,
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
		tokens: () => this.current(),
		handleOf: token => this.handleOf(token),
		byElement: element => this.#pipeline.byElement(element),
		isControlRoot: element => this.#pipeline.isControlRoot(element),
		boundHandles: () => this.#pipeline.bound().values(),
	})

	// Ref registries — populated by framework ref callbacks, read by bind.
	readonly #pendingControls = new Map<string, HTMLElement>()
	readonly #pendingChildSequences = new Map<string, ChildSequenceRegistration>()
	#nextControlId = 0
	#nextChildSequenceId = 0

	#controlElements(): ReadonlySet<HTMLElement> {
		return new Set(this.#pendingControls.values())
	}

	/**
	 * `undefined` is a total answer, not a guard: an unregistered id and an id-less token
	 * both match no registration, so the loop answers `[]` without a branch. Bind's id
	 * pre-pass has already thrown for an id-less token by the time the walk asks.
	 */
	#childSequenceHostsFor(ownerId: number | undefined): HTMLElement[] {
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