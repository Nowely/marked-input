import type {DomRef} from '../../../shared/editorContracts'
import {batch, computed, effect, signal, untracked, watch} from '../../../shared/signals/index.js'
import type {Computed, Event} from '../../../shared/signals/index.js'
import {shallow} from '../../../shared/utils/shallow'
import type {Host} from '../../state/Host'
import type {PropsModel} from '../../state/PropsModel'
import {createCommitPipeline} from '../dom/commit'
import {createControlRoots} from '../dom/controlRoots'
import type {ControlRoots} from '../dom/controlRoots'
import type {BoundaryAffinity} from '../dom/domBoundary'
import {DomModel} from '../dom/DomModel'
import type {SelectionSnapshot} from '../dom/DomModel'
import {SelectionDriver} from '../dom/SelectionDriver'
import type {TokenHandle} from '../dom/TokenHandle'
import {Parser} from '../parser/Parser'
import type {Markup} from '../parser/types'
import {annotate} from '../parser/utils/annotate'
import {adjacentMark as findAdjacentMark, anchorAt as anchorAtOffset, offsetOfAnchor, stepAnchor} from '../tree/anchors'
import {gapWindow} from '../tree/gapWindow'
import {createSelection} from '../tree/selection'
import type {Selection} from '../tree/selection'
import {entryAnchor, mergePlan, movePlan} from '../tree/siblings'
import {createTransactions} from '../tree/transactions'
import {createTokenTree, findNode, rootIndexOf, sliceNodes} from '../tree/tree'
import type {Anchors, MarkNode, MarkPatch, NodeAnchor, TreeCommands, TreeNode} from '../tree/types'
import {createBoundary} from '../tree/valueBoundary'

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
	 * PAYLOAD-FREE, deliberately. It used to carry `{added, removed, updated}` ids derived by a
	 * ledger module; nothing in core read them once the block store moved to a `WeakMap`, and a
	 * consumer that wants to know what changed re-reads {@link nodes} or {@link find}.
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
	 * Resolve a token id to its live handle, or `undefined`. THE identity lookup: a consumer
	 * holding a render-tree token resolves `handle(token.id)` for MEASUREMENT and CARET
	 * commands, and the handle's existence IS the validity check. It carries no data of its
	 * own — content and positions are read from the node ({@link find}).
	 *
	 * ABSENCE IS THE ONLY REFUSAL (ADR-0008). This used to also fail closed for EVERY id
	 * while a structural apply awaited its bind, gated by the pipeline's `pendingStructural`
	 * latch. The reason given was that the node layer is one generation stale — but a node
	 * BORN by that commit has no handle here at all until `bind` creates one
	 * (`dom/bind.ts`), so the refusal it actually needed was already structural. What the
	 * latch added on top was a refusal for nodes that SURVIVED the commit, whose elements are
	 * correct in the window: the per-surface effect has already written the new text
	 * (`commitPipeline.spec.ts`'s fold case). It refused precisely the case that worked.
	 *
	 * A caret placed mid-window against pre-paint parent coordinates is a transient the
	 * post-bind `tokens.bound` re-apply corrects in the same frame (`dom/SelectionDriver`),
	 * and it can no longer steal focus the way it could under N editing hosts, which is the
	 * topology the latch was designed in. Gated by `seam/pendingWindow.spec.ts`.
	 */
	handle(id: number): TokenHandle | undefined {
		return this.#nodes.get(id)
	}

	/**
	 * THE selection state: a pair of `NodeAnchor`s and their derivations, DOM-free. Its DOM
	 * half is the private {@link SelectionDriver} declared in the internals section, whose
	 * reads are exposed here as {@link domAnchors} / {@link focusFirst} /
	 * {@link placeAtHandle}.
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
		anchorAt: (offset, side) => this.anchorAt(offset, side),
		value: () => this.value(),
	})

	// ═══ Adapter SPI ══════════════════════════════════════════════════════════

	/**
	 * Ref callback for a control element (e.g. overlay, drag handle). Registration is
	 * ELEMENT-ONLY — nothing ever asks which token owns a control — and it goes straight into
	 * {@link ControlRoots}, which owns the membership the locate walk reads.
	 *
	 * NO BIND, and that is the whole shape of it. A control used to invalidate a counter the bind
	 * effect watched, so one ref cost a whole-tree walk on the argument that controls are rare.
	 * They are not: block layout mounts up to four per ROW — two drop indicators, a drag handle
	 * and a menu — so that made a block mount quadratic, measured at 400 rows / 400 binds / 93 ms.
	 * A control's ancestor chain is a pure DOM walk that touches no token, so it updates in place.
	 *
	 * REGISTRATION is also where the control leaves the editing host: a control is chrome,
	 * not document content, so inside the one contenteditable container it must be atomic
	 * or the caret and the browser's own editing walk into grips, menus and overlays. It is
	 * written HERE and not in `bind` because controls do not mount on the commit clock — a
	 * menu opening off a block-store signal never sees a re-bind, and would stay editable
	 * until some unrelated commit happened to repaint.
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
	 */
	children(ownerId: number): DomRef {
		return this.#refInto(this.#childSequenceHosts, ownerId)
	}

	/**
	 * Ref callback for a token's OWN element — the thing `bind` currently re-derives by walking
	 * the painted DOM in lockstep with the tree. The framework held this element a moment before
	 * it painted it; consigning it is that association pushed instead of re-discovered.
	 *
	 * THE element source: `bind` and `rebind` both read this registry and nothing else, and the
	 * DOM walk that used to re-derive the same pairing is gone.
	 *
	 * Keyed by owner id, then per REGISTRATION like {@link children}, so a ref that outlives a
	 * re-render cannot be filed under a stale key and one id's element is one lookup.
	 */
	consign(id: number): DomRef {
		return this.#refInto(this.#tokenElements, id)
	}

	/**
	 * The same, for the ROW wrapper a top-level token gets in block layout. Separate from
	 * {@link consign} because they are different elements of the same token — the walk answers
	 * both, and a row holds chrome the token element must not be confused with.
	 */
	consignRow(id: number): DomRef {
		return this.#refInto(this.#rowElements, id)
	}

	// ═══ Engine SPI (in-core consumers) ═══════════════════════════════════════

	/**
	 * THE value read: controlled → the props value; uncontrolled → the last COMMITTED
	 * projection. There is no separate uncontrolled string — the tree IS the store; the
	 * three private inputs (`#seed`, `#seeded`, `#committed`) are declared together in the
	 * internals section below.
	 *
	 * The `#seeded` arm is load-bearing and its gate is NOT the obvious one: reduced to
	 * `props.value() ?? this.#committed()`, the red case is `TokenModel.value.spec`'s "an
	 * unmounted store reads defaultValue before anything has committed" — nothing has
	 * committed there, so `#committed()` is `''`. A store that mounts is seeded by the
	 * mount watch before the first read.
	 */
	readonly value: Computed<string> = computed(
		() => this.props.value() ?? (this.#seeded() ? this.#committed() : this.#seed())
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
	 * `MarkputHandle.replaceRange` reads it only as a success flag.
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
			// adoption walks inert and re-pairs every row BY INDEX, moving `BlockController`'s
			// per-row store onto the wrong row.
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
	 */
	setValue(text: string): boolean {
		return this.replaceBetween('start', 'end', text) !== undefined
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

	/** The projection of the span between two anchors — {@link value} restricted to a window (see {@link sliceNodes}). */
	valueBetween(from: NodeAnchor, to: NodeAnchor): string {
		return untracked(() => sliceNodes(this.#tree.roots(), from, to))
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
	 * The index of the ROOT whose subtree contains `id` — the block ROW index. Off the live
	 * tree, which is the only source: a handle carries no positional data.
	 */
	rootIndexOf(id: number): number | undefined {
		return untracked(() => rootIndexOf(this.#tree.roots(), id))
	}

	/**
	 * A global offset → the node anchor at it (right affinity). THE offset→anchor direction
	 * for the selection write path.
	 *
	 * Seeds for the same reason the write verbs do: an unmaterialized tree has no roots, so
	 * every offset would answer `'end'`.
	 */
	anchorAt(offset: number, side?: 'left' | 'right'): NodeAnchor {
		this.#ensureSeeded()
		return untracked(() => anchorAtOffset(this.#tree.roots(), offset, side))
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

	/**
	 * THE raw selection read: one snapshot of the live window selection (see
	 * {@link DomModel.selection}). The `dom*` prefix is the same authority marker
	 * {@link domAnchors} carries — {@link selection} is the stored anchors.
	 */
	domSelection(): SelectionSnapshot | undefined {
		return this.#dom.selection()
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

	/** Place the caret at a bound handle's start/end; see {@link SelectionDriver.placeAtHandle}. */
	placeAtHandle(handle: TokenHandle, boundary: 'start' | 'end' = 'start'): boolean {
		return this.#selectionDriver.placeAtHandle(handle, boundary)
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
			// ONE watch over the (value, parser, isBlock) tuple: a simultaneous props change is
			// one wave and one commit, where three separate watches would adopt (and announce)
			// two or three times.
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
					// The IMMEDIATE run has no `previous`, so it always takes this arm — including
					// on a re-attach, which rebuilds the onMounted scope and re-runs this watch.
					// `#restore` is what carries an uncontrolled edit across that (gate:
					// `TokenModel.value.spec`'s 'a container re-attach keeps the uncontrolled edit').
					this.#onExternalValue(next.value)
				},
				{immediate: true}
			)
			// THE BIND EFFECT: when does the WHOLE tree get re-projected. A single ref does not
			// come through here at all — {@link consign} calls `rebind(id)` straight away — which
			// is what keeps a mount linear.
			//
			// It subscribes to ONE thing, the commit counter — so that a commit which moves no
			// element still binds, which keeps `bound` a clock every commit reaches and keeps the
			// caret's post-commit re-place.
			//
			// NOT the roots, deliberately, and it is not a gap: every write of `tree.roots` is
			// adoption's, inside a commit that ends in `apply`. Subscribing to both made a
			// structural commit bind TWICE — adoption's batch closes and flushes the effect, then
			// `apply` bumps the counter and flushes it again — for one commit's worth of change.
			//
			// Everything the projection itself reads is read inside `bind`'s own `untracked`, and
			// this `untracked` is a second boundary over `bindNow`'s container read. NEITHER is
			// pinned by a test, and that is stated rather than implied: removing either one leaves
			// the suite green, because the only node signals the walk reads are `children()`
			// (written by adoption, inside a commit that wakes the effect anyway) and `text()`
			// (read inside the per-surface effect, which is its own subscriber). They are
			// correct-by-construction boundaries. What IS pinned — one bind per commit, one rebind
			// per ref — is in `TokenModel.bindEffect.spec.ts`.
			effect(() => {
				this.#pipeline.commits()
				untracked(() => this.#pipeline.bindNow())
			})
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
	 * The markups, compared SHALLOWLY, and that is the whole point of splitting them out.
	 *
	 * `props.options` is a plain signal with no equality, so a fresh-but-identical array — which
	 * is what an inline `options={[…]}` prop produces on every parent render, and what Vue's
	 * `syncProps` allocates unconditionally on a watch that depends on `props.value` — used to
	 * propagate all the way here and mint a new `Parser`. Descriptors are interned PER PARSER and
	 * `adopt` pairs marks on `candidate.descriptor === token.descriptor`, so every mark fell to
	 * `buildNode` and took a NEW ID: a full remount of every Mark in both adapters plus the loss
	 * of `BlockController`'s node-keyed per-row state, on every keystroke of a controlled Vue
	 * editor. Gated by `TokenModel.parse.spec`'s "a fresh but identical `options` array".
	 */
	readonly #markups: Computed<(Markup | undefined)[]> = computed(() => this.props.options().map(opt => opt.markup), {
		equals: shallow,
	})

	/** Whether ANY mark component is configured — the parser is pointless without one. */
	readonly #hasMark: Computed<boolean> = computed(() => {
		const Mark = this.props.Mark()
		return Mark != null || this.props.options().some(opt => 'Mark' in opt && opt.Mark != null)
	})

	readonly #parser: Computed<Parser | undefined> = computed(() => {
		if (!this.#hasMark()) return
		const markups = this.#markups()
		if (!markups.some(Boolean)) return
		return new Parser(markups)
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
				const start = untracked(() => node.position.start)
				if (!this.#applyStructural(node, '')) return
				removed = true
				this.#applyCaret(this.anchorAt(start))
			})
			return removed
		},
		duplicate: node => this.#insertAfter(node, this.valueBetween({before: node}, {after: node})),
		insertAfter: (node, text) => this.#insertAfter(node, text),
		/**
		 * The boundary between the pair, removed by replacing the FIRST node with what survives
		 * it. `next` keeps its own markup, so the merged row is `next`'s wrapping both slots, and
		 * `node` is the one that survives adoption — it re-pairs at its own index, same
		 * descriptor, so the merged row keeps the FIRST row's identity and `next`'s id is what
		 * the commit reports removed.
		 */
		mergeWith: (node, next) => {
			let merged = false
			batch(() => {
				const plan = untracked(() => mergePlan(this.#tree.roots(), node, next))
				if (!plan) return
				if (!this.#applyStructural(node, plan.kept)) return
				merged = true
				this.#applyCaret(this.anchorAt(plan.at))
			})
			return merged
		},
		/**
		 * Deliberately NO {@link #applyCaret}, unlike every other verb here: a removal or an
		 * insertion takes a position out of the document or puts one in, so the caret has to be
		 * told where it went. A move takes NONE out — every node keeps its content and its
		 * identity — so the anchors the selection already holds still name the same characters,
		 * and adoption carries them through untouched.
		 */
		moveTo: (node, index) => {
			this.#ensureSeeded()
			const plan = untracked(() => movePlan(this.#tree.roots(), node, index))
			if (!plan) return false
			return this.#tx.applyRange(plan.window, plan.text)
		},
	}

	/**
	 * Both insert verbs, and the caret rule they share: the caret belongs at the START of what
	 * was inserted, which is the anchor node's trailing edge READ BEFORE the splice. Resolved
	 * against the post-splice tree, so for a slot-leading row markup it lands inside the fresh
	 * row's slot — the same position the composer's `startOf(...)` answered.
	 */
	#insertAfter(node: TreeNode, text: string): boolean {
		this.#ensureSeeded()
		let inserted = false
		batch(() => {
			const index = untracked(() => this.#tree.roots().indexOf(node))
			if (!this.#tx.applyAfter(node, text)) return
			inserted = true
			// The fresh ROOT when the anchor was one — resolved after the splice, so the node
			// exists. A nested insert names no root and leaves the caret to adoption's repair.
			if (index >= 0) this.#enterRoot(index + 1)
		})
		return inserted
	}

	/**
	 * Put the caret INTO root `index` — {@link entryAnchor}'s one rule, applied after the
	 * splice so the row exists to be named. A no-op when no such root came back, which is what
	 * controlled mode always looks like: the tree has not moved, so {@link #applyCaret} would
	 * decline anyway.
	 */
	#enterRoot(index: number): void {
		// `.at` for `entryAnchor`'s reason; a negative index cannot arrive here — every
		// caller derives it from a root index or a literal 0.
		const root = untracked(() => this.#tree.roots().at(index))
		if (root) this.#applyCaret(entryAnchor(root))
	}

	/**
	 * @internal Whole-value replacement that puts the caret INTO a row of the RESULT, named by
	 * index rather than by a character offset into a string that does not exist yet. That
	 * offset was the last absolute coordinate above `tree/` (ADR-0003); an index names a node
	 * the commit is about to produce, which the caller genuinely knows.
	 */
	setValueEnteringRoot(text: string, index: number): boolean {
		if (!this.setValue(text)) return false
		this.#enterRoot(index)
		return true
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
	 * One-shot: the tree holds a value. A SIGNAL, not a plain flag — {@link value} routes on
	 * it, and a field would leave that computed permanently subscribed to `#seed` and blind
	 * to the first commit (gates: `Store.spec`'s three write-then-read-unmounted cases).
	 */
	readonly #seeded = signal({initial: false})
	/** Where an uncontrolled fallback returns to: re-recorded per arrival until control is taken. */
	#restore: string | undefined
	/**
	 * Edge detector for the uncontrolled→controlled transition. A field, not `watch`'s
	 * `previous`, so a container swap (which tears down and rebuilds the onMounted scope)
	 * cannot make a remount look like a fresh edge.
	 */
	#controlled = false
	/**
	 * The commit-generation marker: `join(tree)` as of the last COMPLETED commit, written by
	 * the boundary's `onResult` AFTER `pipeline.apply`. {@link value} reads this and never
	 * `#tree.value()` directly, because `adopt()` writes `tree.roots` inside its own `batch`
	 * whose flush would notify value subscribers while the token view is still stale
	 * (`seam/TokenModel.parse.spec.ts`'s "the live tree is updated when value.current
	 * fires"). Not a second store: one writer, and its content is the tree's own projection
	 * read at that instant, so drift is unrepresentable.
	 */
	readonly #committed = signal({initial: ''})

	readonly #boundary = createBoundary({
		tree: this.#tree,
		parser: () => this.#parser(),
		isBlock: () => this.props.layout.isBlock(),
		controlled: () => this.props.value() !== undefined,
		selection: () => this.selection.anchors(),
		onChange: next => this.props.onChange()?.(next),
		// Synchronous by contract, and ORDER IS LOAD-BEARING inside the `batch` that makes it
		// observable: `#committed` is written AFTER `pipeline.apply` — publishing it first
		// hands subscribers a new string over a stale token view — and `selection.repair` runs
		// LAST, so an imperative post-edit caret (`EditController`) lands later in the same
		// batch and wins by design. `changed` is an EVENT: at depth 0 it flushes its subscribers
		// INSIDE `apply`, ahead of both writes — the batch is what holds them until all three land.
		onResult: result =>
			batch(() => {
				this.#pipeline.apply()
				this.#committed(this.#tree.value())
				this.selection.repair(result)
			}),
	})

	readonly #tx = createTransactions({
		tree: this.#tree,
		readOnly: () => this.props.readOnly(),
		sink: this.#boundary.sink,
	})

	/** One router for every external value: the props watch, and `#ensureSeeded`. */
	#onExternalValue(value: string | undefined): void {
		const controlled = value !== undefined
		// While no parent owns the value every arrival re-records where an uncontrolled fallback
		// returns to — a re-attach re-runs the mount watch's immediate arm, and without this the
		// fallback would be the seed again. Entering controlled mode freezes it. The three arms
		// are pinned separately: never-uncontrolled falls back to the seed, an uncontrolled edit
		// falls back to that edit, and a re-attach keeps it.
		if (!this.#controlled) this.#restore = this.#seeded() ? this.#tree.value() : undefined
		this.#controlled = controlled
		const next = value ?? this.#restore ?? this.#seed()
		this.#seeded(true)
		this.#boundary.arrive(next)
	}

	/**
	 * The tree's materialization point: the write path materializes on first use rather than
	 * waiting for mount, because several specs edit an UNMOUNTED store.
	 *
	 * Reads TRACKED, where every other read on the write path is `untracked`: wrapping this one
	 * drops the `#seeded`/`#seed` subscription a reactive writer on an unseeded store gets today.
	 */
	#ensureSeeded(): void {
		if (this.#seeded()) return
		this.#onExternalValue(this.props.value())
	}

	/**
	 * Control chrome's DOM membership. Not a registry beside the other three: nothing here is
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
			rowElement: id => this.#rowElements.latest(id),
			childSequenceHost: ownerId => this.#childSequenceHosts.sole(ownerId),
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
	readonly #rowElements = new RefRegistry()
	readonly #childSequenceHosts = new RefRegistry()

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
 * A patch becomes markup. Moved out of the deleted `MarkController` (`#serialize` plus its
 * three field defaults) so the node can serialize without reaching into the store; the only
 * semantic change is `null` instead of `{kind: 'clear'}` (plan decision D-b).
 *
 * The defaults come off the NODE: an omitted key must round-trip the current field, and the
 * slot's current value is the joined children, because the node stores no slot text
 * (`MarkNode.slotRange` is positions only).
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