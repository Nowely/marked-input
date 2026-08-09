import type {DomRef, Range, TokenPath} from '../../../shared/editorContracts'
import {computed, signal, untracked, watch} from '../../../shared/signals/index.js'
import type {Computed, Event} from '../../../shared/signals/index.js'
import type {Host} from '../../state/Host'
import type {PropsModel} from '../../state/PropsModel'
import {DomModel} from '../DomModel'
import type {SelectionSnapshot} from '../DomModel'
import {Parser} from '../parser/Parser'
import type {Token} from '../parser/types'
import {pathEquals} from '../tokenIndex'
import {anchorAt, offsetOfAnchor} from '../tree/anchors'
import {createBoundary} from '../tree/boundary'
import {lowerReplace} from '../tree/offsetShim'
import {createSnapshotMemo} from '../tree/snapshotMemo'
import {createTransactions} from '../tree/transactions'
import {createTokenTree, findNode} from '../tree/tree'
import type {NodeAnchor, TreeNode} from '../tree/types'
import {createCommitPipeline} from './commit'
import type {TokenDelta} from './commitInput'
import {applyEditableState} from './editableState'
import type {TokenHandle} from './TokenHandle'
import {fromTransaction} from './treeInput'

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
 * Mechanism ledger (spec §4.6): items 1 (the consume-once hint protocol) and 3
 * (the reparse-watch edit path) died with THIS cutover, not at S1.6d — rewriting
 * the write path deleted `#pendingEdit`/`takePendingEdit`, and arrivals now route
 * explicitly through the boundary. S1.6d's gate therefore has FOUR items left:
 * 2 (`tokenIdentity` + its suites), 4 (the handle write latch), 5
 * (`#preferredHandle` + the selection clamp) and 6 ({@link removedIds}).
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

	/** Ref callback for a control element (e.g. overlay, drag handle). */
	control(ownerPath?: TokenPath): DomRef {
		const key = `control:${++this.#nextControlId}`
		return element => {
			if (element) {
				this.#pendingControls.set(key, {ownerPath: ownerPath ? [...ownerPath] : undefined, element})
			} else {
				this.#pendingControls.delete(key)
			}
		}
	}

	/** Ref callback for the element hosting a token's child sequence. */
	children(ownerPath: TokenPath): DomRef {
		const key = `children:${++this.#nextChildSequenceId}`
		return element => {
			if (element) {
				this.#pendingChildSequences.set(key, {ownerPath: [...ownerPath], element})
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
	 * `ValueModel` is a one-phase facade over this.
	 *
	 * The `#seeded` arm is load-bearing and its gate is NOT the obvious one.
	 * Measured: reduced to `props.value() ?? this.#committed()`, the red cases are
	 * `SelectionController.spec`'s `isAllSelected` › "returns true when range spans
	 * the entire value" and `selectAll` › "retains range intent when the DOM has no
	 * target yet" — both read the value on an UNMOUNTED store, where nothing has
	 * committed yet and `#committed()` is `''`. `ValueModel.spec`'s "initializes from
	 * defaultValue when uncontrolled" stays GREEN: it mounts first, and the mount
	 * watch seeds the tree before the read.
	 */
	readonly value: Computed<string> = computed(
		() => this.props.value() ?? (this.#seeded() ? this.#committed() : this.#seed())
	)

	/**
	 * @internal The internal offset shim (spec D8): a global range → `applyRange`.
	 * THE write entry for every offset-speaking caller; `ValueModel.replace` is a
	 * one-line delegation to it.
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

	/** @internal Whole-node replacement (spec D5) — `MarkController`'s write path. */
	applyStructural(target: TreeNode, replacement: string): boolean {
		this.#ensureSeeded()
		return this.#tx.applyStructural(target, replacement)
	}

	/** Spec §2.3's `input.find`: resolve a stable id to its live node. */
	find(id: number): TreeNode | undefined {
		return untracked(() => findNode(this.#tree.roots(), id))
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
	 */
	offsetOf(anchor: NodeAnchor): number {
		return untracked(() => offsetOfAnchor(this.#tree.roots(), anchor))
	}

	/**
	 * Internal: the `removed` list of the LAST announcement, derived from the
	 * `changed` payload that superseded it. No production consumer is left — it
	 * survives one phase for the specs that read it and is deleted with §4.6
	 * item 6 in S1.6d. Take the payload instead.
	 */
	readonly removedIds = (): readonly number[] => this.#pipeline.removedIds()

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
		for (const handle of this.#pipeline.byPath().values()) {
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
		 * Pre-adoption selection capture (spec D7), injected because `Store` builds
		 * `tokens` before `selection`. Invoked only from the boundary's `fold`, i.e. at
		 * commit/arrival time — never during construction.
		 *
		 * NAMED `selectionBefore`, not `selection`: this class already has a
		 * `selection(): SelectionSnapshot | undefined` Engine SPI method. Measured with
		 * the colliding name: TS2300 (duplicate identifier), TS2403 / TS2687 on the two
		 * declarations, plus TS2322 where the boundary dep then binds to the DOM
		 * snapshot reader instead of the injected thunk.
		 */
		private readonly selectionBefore: () => Range | undefined
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
	readonly #tree = createTokenTree([])
	readonly #memo = createSnapshotMemo()

	/**
	 * The lazily-materialized default — the pre-cutover `ValueModel.current`'s
	 * `initial`, kept verbatim so a `defaultValue` set after the first read stays a
	 * no-op.
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
	 * store through `value.current(next)` and read it back. The writable computed
	 * evaluates its getter BEFORE the set (`signal.ts`'s `writableComputed` reads
	 * `prev` to short-circuit an equal write), which caches the `#seed` arm and its dep
	 * set; a plain field then changes nothing the computed subscribes to, so the read
	 * back is stale. `ValueModel.spec`'s "initializes from defaultValue when
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
		selection: () => this.selectionBefore(),
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
		childSequenceHostsFor: path => this.#childSequenceHostsFor(path),
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
		boundHandles: () => this.#pipeline.byPath().values(),
	})

	// Ref registries — populated by framework ref callbacks, read by bind.
	readonly #pendingControls = new Map<string, ControlRegistration>()
	readonly #pendingChildSequences = new Map<string, ChildSequenceRegistration>()
	#nextControlId = 0
	#nextChildSequenceId = 0

	#controlElements(): ReadonlySet<HTMLElement> {
		const out = new Set<HTMLElement>()
		for (const {element} of this.#pendingControls.values()) out.add(element)
		return out
	}

	#childSequenceHostsFor(ownerPath: TokenPath): HTMLElement[] {
		const out: HTMLElement[] = []
		for (const registration of this.#pendingChildSequences.values()) {
			if (pathEquals(registration.ownerPath, ownerPath)) out.push(registration.element)
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

type ControlRegistration = {
	readonly ownerPath?: TokenPath
	readonly element: HTMLElement
}

type ChildSequenceRegistration = {
	readonly ownerPath: TokenPath
	readonly element: HTMLElement
}