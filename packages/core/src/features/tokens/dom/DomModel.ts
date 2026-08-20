import {untracked} from '../../../shared/signals/index.js'
import type {Id, NodeAnchor, TreeNode} from '../tree/types'
import {getRect, placeRangeAcrossBoundaries} from './caret'
import type {CaretBoundary} from './caret'
import {anchorFromBoundary} from './domBoundary'
import type {AnchorContext, BoundaryAffinity, Lookup} from './domBoundary'
import type {TokenHandle} from './TokenHandle'

export type SelectionAnchor = {node: Node; offset: number; isCollapsed: boolean}

export type SelectionSnapshot = {
	/**
	 * The window selection's first range — the boundary pair the selection driver resolves
	 * through `anchorFor`, and since S2.6 the snapshot's only reading of WHERE the
	 * selection is.
	 *
	 * NOT optional: a snapshot exists only when `rangeCount > 0`, so index 0 is always
	 * there. `selection()?.range` still narrows to `undefined`, which is the "no DOM
	 * selection" answer its consumers need.
	 *
	 * The selection's OWN range, not a clone: Chromium caches one Range per selection, so
	 * this is reference-stable and writes through to the selection. It is NOT forward-live
	 * — MEASURED: a `setBaseAndExtent` detaches the handed-out object, which keeps its old
	 * boundaries. Freshness comes from {@link DomModel.selection} being a pull, so a caller
	 * must read the range in the same turn it took the snapshot. Gated by
	 * `TokenModel.facade.spec`'s "range is the window selection's own range, not a clone".
	 */
	readonly range: globalThis.Range
	/** Viewport rect of the caret/selection. */
	readonly rect: DOMRect | undefined
	/** Anchor node, offset, and collapsed state of the raw window selection. */
	readonly anchor: SelectionAnchor
	/** Focus node of the raw window selection. */
	readonly focusNode: Node | undefined
}

/** What the DOM facade reads from the token layer — nothing more. */
export type DomModelDeps = {
	/** Adapter container; null until mounted. */
	container(): HTMLElement | null
	/** Bound-node lookup for a rendered element. */
	byElement(element: HTMLElement): TokenHandle | undefined
	/** Whether an element is inside a registered control root. */
	isControlRoot(element: HTMLElement): boolean
	/** The live root nodes (TokenModel.nodes()). */
	roots(): readonly TreeNode[]
	/** Stable id → live node (TokenModel.find). */
	find(id: Id): TreeNode | undefined
	/**
	 * Stable id → live handle (TokenModel.handle). Refuses by ABSENCE only (ADR-0008): a node
	 * this commit added has no handle until `bind` makes one, which is the refusal the
	 * placement commands need. It used to ALSO refuse every id while a structural apply
	 * awaited its bind; that gate is gone.
	 */
	handle(id: Id): TokenHandle | undefined
}

/**
 * The DOM↔model facade: resolves live DOM nodes, selections and boundaries to NODE
 * ANCHORS and places anchors back as carets and ranges. Pull-only by design — every
 * read here touches the live DOM. The model side (tree, handles, commits) lives in
 * TokenModel; this class is a stateless view over it plus `domBoundary`/`caret`.
 *
 * It speaks no absolute offsets in either direction as of S2.6 (spec S2 D1): the
 * numeric walk, `boundaryFor` and `SelectionSnapshot.raw` are gone, and with them the
 * bind-generation `Token` reads they needed.
 */
export class DomModel {
	constructor(private readonly deps: DomModelDeps) {}

	/**
	 * Resolve a DOM node to its handle, 'control' if inside a control root,
	 * or undefined if outside the container.
	 */
	handleAt(node: Node): TokenHandle | 'control' | undefined {
		const lookup = this.#locate(node)
		if (!lookup) return undefined
		if (lookup.kind === 'control') return 'control'
		return lookup.handle
	}

	/** Locate the live node owning a DOM node, walking up to the container. */
	#locate(node: Node): Lookup | undefined {
		const container = this.deps.container()
		if (!container) return undefined

		let current: Node | null = node
		while (current && current !== container) {
			if (current instanceof HTMLElement) {
				const handle = this.deps.byElement(current)
				if (handle) {
					const bindings = handle.node()
					return bindings ? {kind: 'token', handle, bindings} : undefined
				}
				if (this.deps.isControlRoot(current)) return {kind: 'control'}
			}
			current = current.parentNode
		}
		return undefined
	}

	#anchorContext(): AnchorContext {
		return {
			container: this.deps.container() ?? undefined,
			locate: node => this.#locate(node),
			find: id => this.deps.find(id),
		}
	}

	/**
	 * Map a DOM boundary (node, offset) to a node anchor in the live tree.
	 *
	 * `untracked` is load-bearing HERE, at the walk's own entry: the walk reads
	 * node `text()` and `children()` signals directly, so any caller inside a
	 * reactive scope would otherwise subscribe to them.
	 */
	anchorFor(node: Node, offset: number, affinity: BoundaryAffinity = 'after'): NodeAnchor | undefined {
		return untracked(() => anchorFromBoundary(this.#anchorContext(), node, offset, affinity))
	}

	/**
	 * THE selection read: one snapshot of the live window selection, or
	 * `undefined` when there is no range (the element is unfocused / nothing
	 * selected). Subsumes the five micro-reads — `range` is the boundary pair (the
	 * selection driver resolves it through `anchorFor`), `rect`/`anchor`/`focusNode`
	 * reflect the raw window selection.
	 * Whether the selection is collapsed is `anchor.isCollapsed`. A consumer that
	 * treated "no selection" as collapsed compares
	 * `selection()?.anchor.isCollapsed !== false`.
	 */
	selection(): SelectionSnapshot | undefined {
		const sel = window.getSelection()
		if (!sel || sel.rangeCount === 0) return undefined
		const anchorNode = sel.anchorNode
		if (!anchorNode) return undefined
		const range = sel.getRangeAt(0)
		return {
			range,
			rect: getRect() ?? undefined,
			anchor: {node: anchorNode, offset: sel.anchorOffset, isCollapsed: sel.isCollapsed},
			focusNode: sel.focusNode ?? undefined,
		}
	}

	/** Current selection serialized for clipboard use. */
	selectedContent(): {html: string; text: string} | undefined {
		const sel = window.getSelection()
		const range = sel?.rangeCount ? sel.getRangeAt(0) : undefined
		if (!range) return undefined
		const fragment = range.cloneContents()
		const div = document.createElement('div')
		div.appendChild(fragment)
		return {html: div.innerHTML, text: range.toString()}
	}

	/**
	 * Place a collapsed caret AT a node anchor, through the anchor's OWN node: the
	 * handle places a LOCAL offset inside its own surface, so it cannot pick the
	 * wrong node at a shared boundary and no absolute coordinate is ever formed
	 * (spec S2 D1).
	 *
	 * FAILS CLOSED where the numeric predecessor guessed. That one searched every
	 * bound surface for the position and fell back to the nearest one, which meant
	 * reading BIND-GENERATION positions (spec S1 D9) — during a structural apply's
	 * pending window they describe a layout the adapter has not painted. Here a node
	 * with no live handle simply declines, and the caret is placed by the
	 * `tokens.bound` re-apply once the bind lands.
	 */
	placeCaret(anchor: NodeAnchor): boolean {
		const target = this.#targetOf(anchor)
		if (!target) return false
		// NO `alive()` gate: `kill` and `unbind` both clear the DOM bindings, and
		// `TokenHandle.placeCaret` already declines a handle without them.
		return this.deps.handle(target.id)?.placeCaret(target.offset) === true
	}

	/**
	 * Select between two node anchors. Order-insensitive: {@link placeRangeAcrossBoundaries}
	 * normalizes the pair in DOM order, because the Range API collapses rather than spans when
	 * its end precedes its start.
	 *
	 * Either end may be a MARK. It could not until now — both had to resolve to a TEXT SURFACE,
	 * on the reading that a Range boundary inside a mark's presentation is not a document
	 * position the model owns. True of the INSIDE, but a mark's endpoints are its PARENT
	 * coordinates (spec S2, and what `placeCaret` has answered since the one-host flip), and
	 * refusing them silently dropped whole selections: on a block document that ends with a
	 * mark, select-all resolved `{after: mark}`, this method declined, and the DOM selection
	 * never moved while the STORED one said all-selected — so the next keystroke replaced a
	 * document the user could not see was selected. Both ends now go through
	 * {@link TokenHandle.caretBoundary}, the same answer `placeCaret` places.
	 */
	selectRange(anchor: NodeAnchor, head: NodeAnchor): boolean {
		const a = this.#boundaryAt(anchor)
		const b = this.#boundaryAt(head)
		if (!a || !b) return false
		placeRangeAcrossBoundaries(a, b)
		return true
	}

	/**
	 * The anchor's own node as an id and a LOCAL offset. `Infinity` is
	 * `TokenHandle.placeCaret`'s "end of this surface" — the offset an `{after: node}`
	 * anchor means without knowing the node's length.
	 *
	 * The two document edges resolve against the live roots rather than declining:
	 * they are the anchors an out-of-range caret intent produces (`anchorAt` answers
	 * `'end'`), and the numeric predecessor placed them through the position they
	 * projected to.
	 */
	#targetOf(anchor: NodeAnchor): {id: Id; offset: number} | undefined {
		if (anchor === 'start') {
			const first = this.deps.roots().at(0)
			return first && {id: first.id, offset: 0}
		}
		if (anchor === 'end') {
			const last = this.deps.roots().at(-1)
			return last && {id: last.id, offset: Infinity}
		}
		if ('node' in anchor) return {id: anchor.node.id, offset: anchor.offset}
		if ('before' in anchor) return {id: anchor.before.id, offset: 0}
		return {id: anchor.after.id, offset: Infinity}
	}

	/**
	 * The anchor as a concrete DOM boundary, through its OWN node's handle — the one the
	 * caret commands place. `undefined` while that handle is absent or unbound, which is the
	 * same fail-closed reading {@link placeCaret} has.
	 */
	#boundaryAt(anchor: NodeAnchor): CaretBoundary | undefined {
		const target = this.#targetOf(anchor)
		if (!target) return undefined
		return this.deps.handle(target.id)?.caretBoundary(target.offset)
	}
}