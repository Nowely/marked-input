import {firstHtmlChild, nodeTarget} from '../../../shared/checkers'
import type {RawSelection} from '../../../shared/editorContracts'
import {listen, signal, watch} from '../../../shared/signals'
import type {Event, Signal} from '../../../shared/signals'
import type {Host} from '../../state/Host'
import type {Token} from '../parser/types'
import type {TokenDelta} from '../seam/commitInput'
import {anchorEquals} from '../tree/anchors'
import type {Selection} from '../tree/selection'
import type {Anchors, Id, NodeAnchor, TreeNode} from '../tree/types'
import type {SelectionSnapshot} from './DomModel'
import type {TokenHandle} from './TokenHandle'

/** What the selection's DOM half reads from the model — nothing more. */
export type SelectionDriverDeps = {
	/** The tree-space half: the stored anchors this driver applies and rewrites. */
	selection: Selection
	host: Host
	readOnly(): boolean
	changed: Event<TokenDelta>
	current(): readonly Token[]
	find(id: Id): TreeNode | undefined
	handleAt(node: Node): TokenHandle | 'control' | undefined
	handle(id: number): TokenHandle | undefined
	handleOf(token: Token | undefined): TokenHandle | undefined
	domSelection(): SelectionSnapshot | undefined
	setEditable(options: {editable: boolean; readOnly: boolean}): void
	placeCaret(rawPosition: number): boolean
	selectRange(start: number, end: number): boolean
	offsetOf(anchor: NodeAnchor): number
	/** THE DOM→model direction: a live DOM boundary as an anchor in the live tree, forming no offset. */
	anchorFor(node: Node, offset: number, affinity?: 'before' | 'after'): NodeAnchor | undefined
}

/**
 * The selection's DOM I/O: the listeners that read the live selection into
 * anchors, the caret application that writes them back, the mouse-sweep flag and
 * the editable policy. The stored state it applies is {@link Selection}, which is
 * DOM-free.
 */
export class SelectionDriver {
	readonly isUserSelecting: Signal<boolean> = signal({initial: false})

	#isPlacingCaret = false

	constructor(private readonly deps: SelectionDriverDeps) {
		deps.host.onMounted(container => {
			this.#focusEmptyEditorOnClick(container)
			this.#trackSelection(container)
			this.#trackUserSelecting(container)

			// The model announces `changed` only after the DOM is consistent (both
			// commit branches), so the caret re-place runs against live surfaces —
			// exactly when the old per-commit index event fired.
			watch(this.deps.changed, () => this.#applySelection())
			// Editable POLICY stays here (readOnly + user-selection sweep gating);
			// the model owns the application: scoped writes on bound surfaces now,
			// and the seed for surfaces bound later.
			watch(
				() => this.deps.readOnly(),
				() => this.#applyEditablePolicy()
			)
			watch(this.isUserSelecting, () => this.#applyEditablePolicy())

			// The STORED anchors, not the derived `range` — MEASURED, not stylistic. `range`
			// dedupes on `shallow`, so at a shared boundary `placeAtHandle` changes the anchor
			// without changing the number and a `range` watch NEVER FIRES: the caret is simply
			// not placed (8 assertion failures across react and vue, in the three focus specs;
			// the core suite stays green, so only `pnpm test` sees this one).
			// Separately, `range` also moves when adoption shifts positions, and re-placing on
			// that would fight the DOM after every commit; the post-commit re-place is the
			// `tokens.changed` watch above, which fires only once the DOM is consistent.
			watch(
				() => this.deps.selection.anchors(),
				() => this.#applySelection()
			)
		})
	}

	#applyEditablePolicy(): void {
		const readOnly = this.deps.readOnly()
		const editable = !(readOnly || this.isUserSelecting())
		this.deps.setEditable({editable, readOnly})
	}

	focusFirst(): void {
		const handle = this.deps.handleOf(this.deps.current()[0])
		if (handle && this.placeAtHandle(handle, 'start')) return
		this.deps.host.container()?.focus()
	}

	/**
	 * DOM TRUTH as anchors (spec S2 D5): what the live window selection says right now,
	 * resolved in the LIVE tree. The `dom*` prefix is the authority marker —
	 * `selection.anchors()` is what the model believes, this is what the DOM says.
	 *
	 * `undefined` for BOTH "no window selection" and "a boundary this layer cannot
	 * resolve". The one caller that must tell those apart is the DOM sync, which reads
	 * the range itself and branches before calling {@link #anchorsIn}.
	 *
	 * S2.5 REVIEWED the fold against the four consumers it converted (`keyboard/input.ts`,
	 * `keyboard/arrowNav.ts`, `keyboard/blockEdit.ts`, `ClipboardController`) and kept it:
	 * every one of them bails on both reasons alike, because both mean "the caret's position
	 * is unknown". What they DO need apart is collapsed-ness, and that is an `anchorEquals`
	 * comparison on the answer, not a second `undefined`.
	 */
	domAnchors(): Anchors | undefined {
		const range = this.deps.domSelection()?.range
		return range ? this.#anchorsIn(range) : undefined
	}

	/** The two `anchorFor` calls both DOM-truth reads share; `undefined` if either end declines. */
	#anchorsIn(range: globalThis.Range): Anchors | undefined {
		// A DOM Range is always document-ordered, and these are the affinities the numeric
		// read used, so `anchor` is the low end and `head` the high one.
		const anchor = this.deps.anchorFor(range.startContainer, range.startOffset, 'after')
		const head = this.deps.anchorFor(range.endContainer, range.endOffset, 'before')
		return anchor && head ? {anchor, head} : undefined
	}

	/**
	 * DOM truth as absolute offsets: {@link domAnchors} projected through `offsetOf`.
	 *
	 * LIVE space now, not bind-generation. The old reading went through
	 * `SelectionSnapshot.raw`, which adds a `position.start` off the handle's BIND
	 * generation (spec S1 D9); anchors name live nodes and `offsetOf` reads live
	 * positions, so the adopt→bind window stops being a coordinate hazard here. It also
	 * inherits `anchorFor`'s narrower fail-closed conditions (spec S2 D4).
	 *
	 * NO `direction` in the answer: anchors carry none, and nothing reads it — the field
	 * is produced by `DomModel.#rawSelectionFrom` and consumed nowhere in the repo.
	 * `SelectionSnapshot.raw` still carries it; both die with the numeric space at S2.6.
	 *
	 * NO PRODUCTION CALLER since S2.5 — `keyboard/` and `ClipboardController` read
	 * {@link domAnchors} directly, and the "answers `undefined` when the window selection is
	 * gone" contract moved with them (its gate is `input.spec`'s "clears the whole value even
	 * when the DOM selection is gone"). What is left is `dom/domBoundary.spec`; this and the
	 * whole numeric space die at S2.6.
	 */
	readRaw(): RawSelection | undefined {
		const anchors = this.domAnchors()
		if (!anchors) return undefined
		const anchor = this.deps.offsetOf(anchors.anchor)
		const head = this.deps.offsetOf(anchors.head)
		return {range: anchor <= head ? {start: anchor, end: head} : {start: head, end: anchor}}
	}

	placeAtHandle(handle: TokenHandle, boundary: 'start' | 'end' = 'start'): boolean {
		// A dead or mid-window handle fails closed; alive() is the mount check.
		if (!handle.alive()) return false
		const node = this.deps.find(handle.id)
		if (!node) return false
		// Re-apply even when the write dedupes: the DOM caret may have moved since.
		if (!this.deps.selection.selectNode(node, boundary)) this.#applySelection()
		return true
	}

	#applySelection(): void {
		if (this.isUserSelecting()) return
		const anchors = this.deps.selection.anchors()
		if (anchors === undefined) return

		// NO CLAMP (spec S1 §4.6 item 5): an anchor cannot point past its own node, `anchorAt`
		// answers `'end'` for an out-of-range offset, and `TokenHandle.placeCaret` bounds
		// the local offset to the surface it places in. There is nothing left to clamp and
		// nothing to write back.
		this.#isPlacingCaret = true
		try {
			if (anchorEquals(anchors.anchor, anchors.head)) {
				this.#placeAt(anchors.head)
				return
			}
			const range = this.deps.selection.range()
			if (range) this.deps.selectRange(range.start, range.end)
		} finally {
			this.#isPlacingCaret = false
		}
	}

	/**
	 * Collapsed placement through the anchor's OWN node: the handle places a LOCAL offset
	 * inside its own surface, so it cannot pick the wrong node at a shared boundary and it
	 * never converts to an absolute coordinate (which would resolve against
	 * bind-generation positions, spec S1 D9). The raw fallback covers an anchor whose node
	 * has no bound handle yet — the latch-gated `handle(id)` serves `undefined` during the
	 * pending window, exactly as the old stash did.
	 */
	#placeAt(anchor: NodeAnchor): void {
		const target = anchorTarget(anchor)
		if (target) {
			const handle = this.deps.handle(target.id)
			if (handle?.alive() && handle.placeCaret(target.offset)) return
		}
		this.deps.placeCaret(this.deps.offsetOf(anchor))
	}

	#focusEmptyEditorOnClick(container: HTMLElement): void {
		listen(container, 'click', () => {
			// The fresh reconciled tree: after typing into the single empty text
			// token, tokens() tracks value.current() (renderTree keeps its stale
			// reference — reading it would steal focus into a non-empty editor).
			const tokens = this.deps.current()
			if (tokens.length === 1 && tokens[0].type === 'text' && tokens[0].content === '') {
				firstHtmlChild(container)?.focus()
			}
		})
	}

	#trackUserSelecting(container: HTMLElement): void {
		let pressedAt: Node | null = null

		listen(document, 'mousedown', e => {
			pressedAt = nodeTarget(e)
		})

		listen(document, 'mousemove', e => {
			if (pressedAt === null) return
			const startedOutsideEditor = !container.contains(pressedAt)
			const sweepingAcrossNodes = pressedAt !== e.target
			const selectionIntersectsEditor = this.deps.domSelection()?.intersects(container) ?? false
			if ((startedOutsideEditor || sweepingAcrossNodes) && selectionIntersectsEditor) {
				this.isUserSelecting(true)
			}
		})

		const clearIfCollapsed = (): void => {
			if (!this.isUserSelecting()) return
			// No selection (undefined) is treated like collapsed, matching the raw `!sel || sel.isCollapsed`.
			if (this.deps.domSelection()?.anchor.isCollapsed !== false) this.isUserSelecting(false)
		}

		listen(document, 'mouseup', () => {
			pressedAt = null
			clearIfCollapsed()
		})

		listen(document, 'selectionchange', clearIfCollapsed)
	}

	#trackSelection(container: HTMLElement): void {
		/**
		 * THE DOM→model direction, and the whole of it: the DOM's own boundaries resolved
		 * straight into anchors in the live tree. No offset is formed anywhere on this path,
		 * so the anchor the DOM produces IS the anchor stored and `anchorEquals` dedupes on
		 * identity.
		 *
		 * That is what retired the numeric-equality guard this used to open with. The guard
		 * existed only because `anchorAt(offsetOf(a)) !== a` at a shared boundary — `anchorAt`
		 * is right-affine, so every deliberately far-side anchor (`{before}`, `{after}`, an
		 * end-of-text offset) came back as a DIFFERENT anchor with the SAME number and dragged
		 * focus onto the neighbouring text node. With no round-trip the premise is gone, and
		 * with it the guard's cost: a caret that MOVES ACROSS a shared boundary without moving
		 * its offset now updates the stored anchor, where the guard suppressed it.
		 *
		 * THE TWO EXITS DIFFER DELIBERATELY, and both are the pre-anchor behavior:
		 * no DOM selection CLEARS; an unresolvable boundary LEAVES THE ANCHORS STANDING
		 * (spec S2 D4 — `undefined` means "the DOM cannot be read here", and the next
		 * `selectionchange` corrects it). Gated by `SelectionDriver.spec`'s two
		 * "focusin …" cases, which swap red for red if the exits are swapped.
		 */
		const sync = (): void => {
			const range = this.deps.domSelection()?.range
			if (!range) {
				this.deps.selection.clear()
				return
			}
			// NOT `domAnchors()`: that folds both `undefined` reasons into one, and the two
			// exits here must stay apart. The shared half is `#anchorsIn`.
			const anchors = this.#anchorsIn(range)
			if (!anchors) return
			this.deps.selection.select(anchors.anchor, anchors.head)
		}

		const syncIfInEditor = (node: Node): void => {
			const at = this.deps.handleAt(node)
			if (at && at !== 'control') {
				sync()
				return
			}
			if (at === 'control') return
			this.deps.selection.clear()
		}

		listen(container, 'focusin', e => {
			if (this.#isPlacingCaret) return
			const target = e.target instanceof HTMLElement ? e.target : undefined
			if (!target) {
				this.deps.selection.clear()
				return
			}
			syncIfInEditor(target)
		})

		listen(container, 'focusout', () => {
			queueMicrotask(() => {
				if (!container.contains(document.activeElement)) this.deps.selection.clear()
			})
		})

		listen(document, 'selectionchange', () => {
			if (this.#isPlacingCaret) return
			const focusNode = this.deps.domSelection()?.focusNode
			if (!focusNode) return
			syncIfInEditor(focusNode)
		})
	}
}

/** Id and local offset of an anchor's own node; undefined for the document edges. */
function anchorTarget(anchor: NodeAnchor): {id: number; offset: number} | undefined {
	if (typeof anchor === 'string') return undefined
	if ('node' in anchor) return {id: anchor.node.id, offset: anchor.offset}
	if ('before' in anchor) return {id: anchor.before.id, offset: 0}
	return {id: anchor.after.id, offset: Infinity}
}