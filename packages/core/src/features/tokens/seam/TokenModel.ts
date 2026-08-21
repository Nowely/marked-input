import type {DomRef} from '../../../shared/editorContracts'
import {batch, computed, signal, untracked, watch} from '../../../shared/signals/index.js'
import type {Computed, Event} from '../../../shared/signals/index.js'
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
import {Parser} from '../parser/Parser'
import type {Markup} from '../parser/types'
import {annotate} from '../parser/utils/annotate'
import {adjacentMark as findAdjacentMark, anchorAt as anchorAtOffset, offsetOfAnchor, stepAnchor} from '../tree/anchors'
import {gapWindow} from '../tree/gapWindow'
import {createSelection} from '../tree/selection'
import type {Selection} from '../tree/selection'
import {entryAnchor, mergePlan, movePlan, removePlan} from '../tree/siblings'
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
		anchorAt: (offset, side) => this.anchorAt(offset, side),
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
	 * block layout mounts up to four controls per ROW, measured at 400 rows / 400 binds / 93 ms.
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
	 * THE value read: controlled → the props value; uncontrolled → the last COMMITTED
	 * projection. There is no separate uncontrolled string — the tree IS the store; its two
	 * private inputs (`#seed`, `#committed`) are declared together in the internals section
	 * below, and `#seeded` is derived from the tree beside them.
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
	 * Deliberately kept: spec-facing and public-reachable through the exported Store (`store.tokens`) — the `api.focus()` precedent.
	 *
	 * `enterRoot` puts the caret INTO that row of the RESULT, named by index rather than by a
	 * character offset into a string that does not exist yet — that offset was the last
	 * absolute coordinate above `tree/` (ADR-0003), while an index names a node the commit is
	 * about to produce, which the caller genuinely knows. A separate verb until the
	 * API-surface cut; the block callers are the only ones that pass it.
	 */
	setValue(text: string, enterRoot?: number): boolean {
		if (this.replaceBetween('start', 'end', text) === undefined) return false
		if (enterRoot !== undefined) this.#enterRoot(enterRoot)
		return true
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
			// ONE watch over the (value, parser, isBlock, separator) tuple: a simultaneous props
			// change is one wave and one commit, where separate watches would adopt (and
			// announce) several times.
			watch(
				() => ({
					value: this.props.value(),
					parser: this.#parser(),
					isBlock: this.props.layout.isBlock(),
					separator: this.props.separator(),
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
	 * pairs marks on descriptor identity, so a new parser remounts every Mark with a NEW ID and
	 * drops `BlockController`'s node-keyed per-row state — on every keystroke of a controlled
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
				// The document-final row owns no separator, so its removal takes the PREVIOUS
				// row's — a span-only splice would just convert it into the trailing empty row
				// (issue 08 review finding). removePlan's root indexOf is the liveness check.
				const plan = untracked(() => removePlan(this.#tree.roots(), node))
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
			// The document-final row carries no separator; without one between the copies
			// they fuse into a single row (issue 08 review finding) — the same
			// normalization movePlan applies to a moved span.
			const text = untracked(() =>
				node.kind === 'row' && node.terminator === '' ? this.props.separator() + projection : projection
			)
			return this.#insertAfter(node, text)
		},
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
	/**
	 * The commit-generation marker: `join(tree)` as of the last COMPLETED commit, written by
	 * the boundary's `onResult` AFTER `pipeline.apply`. {@link value} reads this and never
	 * `#tree.value()` directly, because `adopt()` writes `tree.roots` inside its own `batch`
	 * whose flush would notify value subscribers while the token view is still stale
	 * (`seam/TokenModel.parse.spec.ts`'s "the live tree is updated when value.current
	 * fires"). Not a second store: one writer, and its content is the tree's own projection
	 * read at that instant, so drift is unrepresentable — its deletion is refuted in the
	 * README's list.
	 */
	readonly #committed = signal({initial: ''})

	readonly #boundary = createBoundary({
		tree: this.#tree,
		parser: () => this.#parser(),
		isBlock: () => this.props.layout.isBlock(),
		separator: () => this.props.separator(),
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