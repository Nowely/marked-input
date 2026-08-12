import {listen, watch} from '../../../shared/signals'
import type {Event} from '../../../shared/signals'
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
	/** The live root nodes — {@link SelectionDriver.focusFirst}'s first-token read, and nothing more. */
	nodes(): readonly TreeNode[]
	find(id: Id): TreeNode | undefined
	handle(id: Id): TokenHandle | undefined
	handleAt(node: Node): TokenHandle | 'control' | undefined
	domSelection(): SelectionSnapshot | undefined
	/** THE model→DOM direction: a stored anchor placed through its OWN node (spec S2 D1). */
	placeCaret(anchor: NodeAnchor): boolean
	selectRange(anchor: NodeAnchor, head: NodeAnchor): boolean
	/** THE DOM→model direction: a live DOM boundary as an anchor in the live tree, forming no offset. */
	anchorFor(node: Node, offset: number, affinity?: 'before' | 'after'): NodeAnchor | undefined
}

/**
 * The selection's DOM I/O: the listeners that read the live selection into
 * anchors, the caret application that writes them back, and the one editing
 * host's `contenteditable`. The stored state it applies is {@link Selection},
 * which is DOM-free.
 */
export class SelectionDriver {
	constructor(private readonly deps: SelectionDriverDeps) {
		deps.host.onMounted(container => {
			this.#trackSelection(container)

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
	 * resolve", and no caller tells them apart.
	 *
	 * S2.5 REVIEWED the fold against its consumers (`keyboard/input.ts`,
	 * `keyboard/blockEdit.ts`, `ClipboardController`) and kept it: every one of them bails on
	 * both reasons alike, because both mean "the caret's position is unknown". What they DO
	 * need apart is collapsed-ness, and that is an `anchorEquals` comparison on the answer,
	 * not a second `undefined`.
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
		const anchors = this.deps.selection.anchors()
		if (anchors === undefined) return

		// NO CLAMP (spec S1 §4.6 item 5): an anchor cannot point past its own node, `anchorAt`
		// answers `'end'` for an out-of-range offset, and `TokenHandle.placeCaret` bounds
		// the local offset to the surface it places in. There is nothing left to clamp and
		// nothing to write back.
		//
		// No re-entry flag either: Chromium — the pinned scope — dispatches `selectionchange`
		// on a task, never synchronously from the write, so the sync below cannot observe a
		// half-applied placement. MEASURED across all three write forms (`addRange`,
		// `setBaseAndExtent`, `collapse` under focus).
		//
		// ANCHORS on both arms, and the ranged one no longer detours through the derived
		// numeric `range`: normalizing the pair is DOM-order work the placement owns.
		if (anchorEquals(anchors.anchor, anchors.head)) {
			this.deps.placeCaret(anchors.head)
			return
		}
		this.deps.selectRange(anchors.anchor, anchors.head)
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
		 * ONE EXIT, and it LEAVES THE ANCHORS STANDING (spec S2 D4 — `undefined` means "the
		 * DOM cannot be read here", and the next `selectionchange` corrects it). Gated by
		 * `SelectionDriver.spec`'s "a half-outside range leaves the stored anchors standing".
		 * Dropping the selection entirely is the `focusout` clear below, not this path.
		 */
		const sync = (): void => {
			const anchors = this.domAnchors()
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

		listen(container, 'focusout', () => {
			queueMicrotask(() => {
				if (!container.contains(document.activeElement)) this.deps.selection.clear()
			})
		})

		listen(document, 'selectionchange', () => {
			const focusNode = this.deps.domSelection()?.focusNode
			if (!focusNode) return
			syncIfInEditor(focusNode)
		})
	}
}