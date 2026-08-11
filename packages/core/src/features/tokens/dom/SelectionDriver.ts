import {firstHtmlChild, nodeTarget} from '../../../shared/checkers'
import {listen, signal, watch} from '../../../shared/signals'
import type {Event, Signal} from '../../../shared/signals'
import type {Host} from '../../state/Host'
import {anchorEquals} from '../tree/anchors'
import type {Selection} from '../tree/selection'
import type {Anchors, Id, NodeAnchor, TreeNode} from '../tree/types'
import type {TokenDelta} from './commit'
import type {SelectionSnapshot} from './DomModel'
import type {TokenHandle} from './TokenHandle'

/** What the selection's DOM half reads from the model — nothing more. */
export type SelectionDriverDeps = {
	/** The tree-space half: the stored anchors this driver applies and rewrites. */
	selection: Selection
	host: Host
	readOnly(): boolean
	changed: Event<TokenDelta>
	/** The live root nodes — the row/first-token reads below, and nothing more. */
	nodes(): readonly TreeNode[]
	find(id: Id): TreeNode | undefined
	handle(id: Id): TokenHandle | undefined
	handleAt(node: Node): TokenHandle | 'control' | undefined
	domSelection(): SelectionSnapshot | undefined
	setEditable(options: {editable: boolean; readOnly: boolean}): void
	/** THE model→DOM direction: a stored anchor placed through its OWN node (spec S2 D1). */
	placeCaret(anchor: NodeAnchor): boolean
	selectRange(anchor: NodeAnchor, head: NodeAnchor): boolean
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
			// THE editing host: the container, gated only by readOnly. `immediate` is the
			// mount write; per-token topology is bind's.
			watch(
				() => this.deps.readOnly(),
				readOnly => {
					const attr = readOnly ? 'false' : 'true'
					if (container.contentEditable !== attr) container.contentEditable = attr
				},
				{immediate: true}
			)
			// What is left of the editable POLICY: the user-selection sweep gating. The
			// model owns the application, and readOnly is the container write above —
			// nothing below the host reads it any more.
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
		// `.at`, not `[]`: `noUncheckedIndexedAccess` is off, so an index read types as
		// `TreeNode` and the empty-tree guard is linted away as an impossible condition.
		const first = this.deps.nodes().at(0)
		const handle = first && this.deps.handle(first.id)
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

	/** The `anchorFor` reads both DOM-truth reads share; `undefined` if either end declines. */
	#anchorsIn(range: globalThis.Range): Anchors | undefined {
		// A DOM Range is always document-ordered, and these are the affinities the numeric
		// read used, so `anchor` is the low end and `head` the high one.
		const anchor = this.deps.anchorFor(range.startContainer, range.startOffset, 'after')
		// ONE READ for a collapsed range, because the opposite affinities exist to make the
		// ENDS of a span lean inward — read twice against a single boundary they answer two
		// NAMES for one position and the pair stops comparing equal. That is not cosmetic:
		// `#applySelection` would take the ranged branch for a caret, where `selectRange`
		// declines any endpoint without a text surface. Reachable since a mark's caret became
		// a container boundary, whose two sides are different nodes ({before: next root} vs
		// {after: the mark}).
		if (range.collapsed) return anchor && {anchor, head: anchor}
		const head = this.deps.anchorFor(range.endContainer, range.endOffset, 'before')
		return anchor && head ? {anchor, head} : undefined
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
			// ANCHORS on both arms, and the ranged one no longer detours through the derived
			// numeric `range`: normalizing the pair is DOM-order work the placement owns.
			if (anchorEquals(anchors.anchor, anchors.head)) {
				this.deps.placeCaret(anchors.head)
				return
			}
			this.deps.selectRange(anchors.anchor, anchors.head)
		} finally {
			this.#isPlacingCaret = false
		}
	}

	#focusEmptyEditorOnClick(container: HTMLElement): void {
		listen(container, 'click', () => {
			// The LIVE tree, which after typing into the single empty text node already
			// holds that keystroke — a painted generation would still read empty here and
			// steal focus into a non-empty editor.
			const roots = this.deps.nodes()
			if (roots.length === 1 && roots[0].kind === 'text' && roots[0].text() === '') {
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
			// The container IS the editor, and it owns no token: `handleAt` answers
			// `undefined` for it, which is the "outside" verdict. Its own boundaries are
			// where a caret before or after a top-level mark lives, so they must SYNC.
			if (node === container) {
				sync()
				return
			}
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