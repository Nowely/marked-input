import type {RawSelection} from '../../../shared/editorContracts'
import type {Token} from '../parser/types'
import type {Id, NodeAnchor, TreeNode} from '../tree/types'
import {focusIfNeeded, getRect, placeAtChildBoundary, placeAtTextOffset, placeRangeAcrossSurfaces} from './caret'
import {anchorFromBoundary, markBoundaryAt, rawPositionFromBoundary, textTargetAt} from './domBoundary'
import type {AnchorContext, BoundaryContext, Lookup, TokenView} from './domBoundary'
import type {TokenHandle} from './TokenHandle'

export type SelectionAnchor = {node: Node; offset: number; isCollapsed: boolean}

export type SelectionSnapshot = {
	/** Absolute in-editor positions of the selection, or undefined if it falls outside any bound token. */
	readonly raw: RawSelection | undefined
	/** Viewport rect of the caret/selection. */
	readonly rect: DOMRect | undefined
	/** Anchor node, offset, and collapsed state of the raw window selection. */
	readonly anchor: SelectionAnchor
	/** Focus node of the raw window selection. */
	readonly focusNode: Node | undefined
	/** Whether the raw selection intersects `node` (partial containment counts). */
	intersects(node: Node): boolean
}

/** What the DOM facade reads from the token layer — nothing more. */
export type DomModelDeps = {
	/** Adapter container; null until mounted. */
	container(): HTMLElement | null
	/** The always-fresh reconciled tree (TokenModel.current). */
	tokens(): readonly Token[]
	/** The latch-gated id bridge (TokenModel.handleOf) — fails closed mid-window. */
	handleOf(token: Token): TokenHandle | undefined
	/** Bound-node lookup for a rendered element. */
	byElement(element: HTMLElement): TokenHandle | undefined
	/** Whether an element is inside a registered control root. */
	isControlRoot(element: HTMLElement): boolean
	/** Every currently bound live handle (NOT latch-gated — the boundary facade reads bound state as-is). */
	boundHandles(): Iterable<TokenHandle>
	/** The live root nodes (TokenModel.nodes()). */
	roots(): readonly TreeNode[]
	/** Stable id → live node (TokenModel.find) — NOT latch-gated. */
	find(id: Id): TreeNode | undefined
	/** Latch-gated id → handle (TokenModel.handle), for the bound-view lookup. */
	handleById(id: Id): TokenHandle | undefined
}

/**
 * The DOM↔model facade: resolves live DOM nodes, selections, and boundaries to
 * model coordinates and places carets/ranges back. Pull-only by design — every
 * read here touches the live DOM. The model side (tree, handles, commits) lives
 * in TokenModel; this class is a stateless view over it plus `boundary`/`caret`.
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
		return lookup.node.handle
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
					const view = this.#view(handle)
					return view ? {kind: 'token', node: view} : undefined
				}
				if (this.deps.isControlRoot(current)) return {kind: 'control'}
			}
			current = current.parentNode
		}
		return undefined
	}

	/** View of a handle for the boundary facade: its live DOM bindings plus the handle. */
	#view(handle: TokenHandle): TokenView | undefined {
		const bindings = handle.node()
		if (!bindings) return undefined
		return {handle, ...bindings}
	}

	*#views(): IterableIterator<TokenView> {
		for (const handle of this.deps.boundHandles()) {
			const view = this.#view(handle)
			if (view) yield view
		}
	}

	/** The view's fresh current token while its handle is live. */
	#tokenOf(view: TokenView): Token | undefined {
		return view.handle.alive() ? view.handle.token() : undefined
	}

	/** Id-bridged view of a current-tree token's bound node (boundary internals). */
	#viewOf(token: Token): TokenView | undefined {
		const handle = this.deps.handleOf(token)
		return handle ? this.#view(handle) : undefined
	}

	#boundaryContext(): BoundaryContext {
		return {
			container: this.deps.container() ?? undefined,
			tokens: this.deps.tokens(),
			tokenOf: view => this.#tokenOf(view),
			viewOf: token => this.#viewOf(token),
			locate: node => this.#locate(node),
			nodes: () => this.#views(),
		}
	}

	/**
	 * Deliberately does NOT spread {@link #boundaryContext}: {@link AnchorContext}
	 * picks the two DOM-side fields precisely so the bind-generation reads stay
	 * unreachable from this path.
	 */
	#anchorContext(): AnchorContext {
		return {
			container: this.deps.container() ?? undefined,
			locate: node => this.#locate(node),
			roots: () => this.deps.roots(),
			find: id => this.deps.find(id),
			viewOfId: id => {
				const handle = this.deps.handleById(id)
				return handle ? this.#view(handle) : undefined
			},
		}
	}

	/** Map a DOM boundary (node, offset) to an absolute document position. */
	boundaryFor(node: Node, offset: number, affinity: 'before' | 'after' = 'after'): number | undefined {
		return rawPositionFromBoundary(this.#boundaryContext(), node, offset, affinity)
	}

	/** Map a DOM boundary (node, offset) to a node anchor in the live tree. */
	anchorFor(node: Node, offset: number, affinity: 'before' | 'after' = 'after'): NodeAnchor | undefined {
		return anchorFromBoundary(this.#anchorContext(), node, offset, affinity)
	}

	/**
	 * THE selection read: one snapshot of the live window selection, or
	 * `undefined` when there is no range (the element is unfocused / nothing
	 * selected). Subsumes the six micro-reads — `raw` is the absolute in-editor
	 * range (undefined when the selection is outside the editor), `rect`/`anchor`/
	 * `focusNode` reflect the raw selection, and `intersects` closes over it.
	 * Whether the selection is collapsed is `anchor.isCollapsed`. A consumer that
	 * treated "no selection" as collapsed compares
	 * `selection()?.anchor.isCollapsed !== false`.
	 */
	selection(): SelectionSnapshot | undefined {
		const sel = window.getSelection()
		if (!sel || sel.rangeCount === 0) return undefined
		const anchorNode = sel.anchorNode
		if (!anchorNode) return undefined
		return {
			raw: this.#rawSelectionFrom(sel),
			rect: getRect() ?? undefined,
			anchor: {node: anchorNode, offset: sel.anchorOffset, isCollapsed: sel.isCollapsed},
			focusNode: sel.focusNode ?? undefined,
			intersects: node => sel.containsNode(node, true),
		}
	}

	/** Absolute in-editor positions of a window selection's first range, or undefined if it maps outside any bound token. */
	#rawSelectionFrom(selection: Selection): RawSelection | undefined {
		const range = selection.getRangeAt(0)
		const start = this.boundaryFor(range.startContainer, range.startOffset, 'after')
		if (start === undefined) return undefined
		const end = this.boundaryFor(range.endContainer, range.endOffset, 'before')
		if (end === undefined) return undefined

		const rangeValue = start <= end ? {start, end} : {start: end, end: start}
		const direction =
			rangeValue.start === rangeValue.end
				? undefined
				: selection.anchorNode === range.endContainer && selection.anchorOffset === range.endOffset
					? 'backward'
					: 'forward'

		return direction ? {range: rangeValue, direction} : {range: rangeValue}
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
	 * Place a collapsed caret at an absolute document position: the text surface
	 * containing it, else a mark boundary exactly there, else the nearest text
	 * surface. (Per-token placement is `TokenHandle.placeCaret`.)
	 */
	placeCaret(rawPosition: number): boolean {
		const ctx = this.#boundaryContext()

		const textTarget = textTargetAt(ctx, rawPosition)
		if (textTarget?.node.textElement && rawPosition >= textTarget.start && rawPosition <= textTarget.end) {
			focusIfNeeded(textTarget.node.textElement)
			placeAtTextOffset(textTarget.node.textElement, rawPosition - textTarget.start)
			return true
		}

		const markTarget = markBoundaryAt(ctx, rawPosition)
		if (markTarget) {
			focusIfNeeded(markTarget.element)
			placeAtChildBoundary(markTarget.element, rawPosition === markTarget.position.end ? 'end' : 'start')
			return true
		}

		if (textTarget?.node.textElement) {
			focusIfNeeded(textTarget.node.textElement)
			placeAtTextOffset(textTarget.node.textElement, rawPosition - textTarget.start)
			return true
		}

		return false
	}

	/**
	 * Select [start, end]; collapses via placeCaret when equal. Order-
	 * insensitive: the range is normalized to [lo, hi] before being forwarded
	 * to the DOM Range API (which would throw on a reversed range).
	 */
	selectRange(start: number, end: number): boolean {
		if (start === end) return this.placeCaret(start)
		const [lo, hi] = start <= end ? [start, end] : [end, start]
		const ctx = this.#boundaryContext()
		const startTarget = textTargetAt(ctx, lo)
		const endTarget = textTargetAt(ctx, hi)
		if (!startTarget?.node.textElement || !endTarget?.node.textElement) return false
		placeRangeAcrossSurfaces(
			{element: startTarget.node.textElement, offset: lo - startTarget.start},
			{element: endTarget.node.textElement, offset: hi - endTarget.start}
		)
		return true
	}
}