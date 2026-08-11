// packages/core/src/features/selection/SelectionController.ts
import type {Computed, Signal} from '../../shared/signals'
import type {Host} from '../state/Host'
import type {PropsModel} from '../state/PropsModel'
import {createSelection, SelectionDriver} from '../tokens'
import type {Anchors, NodeAnchor, Selection, TokenHandle, TokenModel, TransactionResult, TreeNode} from '../tokens'

/**
 * The selection seam, and nothing more: {@link Selection} holds the tree-space state and
 * {@link SelectionDriver} owns the DOM I/O over it. Both live in the token layer; this
 * class only composes them, because `Store` constructs the selection while `TokenModel`
 * keeps its tree private.
 */
export class SelectionController {
	readonly isAllSelected: Computed<boolean>
	readonly isUserSelecting: Signal<boolean>

	readonly #state: Selection
	readonly #driver: SelectionDriver

	constructor(host: Host, tokens: TokenModel, props: PropsModel) {
		this.#state = createSelection({
			offsetOf: anchor => tokens.offsetOf(anchor),
			anchorAt: offset => tokens.anchorAt(offset),
			value: () => tokens.value(),
		})
		this.#driver = new SelectionDriver({
			selection: this.#state,
			host,
			readOnly: () => props.readOnly(),
			changed: tokens.changed,
			nodes: () => tokens.nodes(),
			find: id => tokens.find(id),
			handle: id => tokens.handle(id),
			handleAt: node => tokens.handleAt(node),
			domSelection: () => tokens.selection(),
			setEditable: options => tokens.setEditable(options),
			placeCaret: anchor => tokens.placeCaret(anchor),
			selectRange: (anchor, head) => tokens.selectRange(anchor, head),
			anchorFor: (node, offset, affinity) => tokens.anchorFor(node, offset, affinity),
		})

		this.isAllSelected = this.#state.isAllSelected
		this.isUserSelecting = this.#driver.isUserSelecting
	}

	selectAll(): void {
		this.#state.selectAll()
	}

	/** @internal See {@link Selection.select}. */
	select(anchor: NodeAnchor, head: NodeAnchor = anchor): boolean {
		return this.#state.select(anchor, head)
	}

	/** @internal See {@link Selection.selectNode} — the node IS the disambiguator at a shared boundary. */
	selectNode(node: TreeNode, boundary: 'start' | 'end'): boolean {
		return this.#state.selectNode(node, boundary)
	}

	/** @internal See {@link Selection.repair} — the `SelectionPort` half `TokenModel` calls. */
	repair(result: TransactionResult): void {
		this.#state.repair(result)
	}

	/** Spec §2.3's `input.selection()`: the STORED anchors (spec S1 D7). */
	anchors(): Anchors | undefined {
		return this.#state.anchors()
	}

	/** @internal See {@link Selection.caretAnchor} — `MarkputApi`'s `'caret'` resolution. */
	caretAnchor(): NodeAnchor | undefined {
		return this.#state.caretAnchor()
	}

	focusFirst(): void {
		this.#driver.focusFirst()
	}

	/** THE DOM-truth read (spec S2 D5): see {@link SelectionDriver.domAnchors}. */
	domAnchors(): Anchors | undefined {
		return this.#driver.domAnchors()
	}

	placeAtHandle(handle: TokenHandle, boundary: 'start' | 'end' = 'start'): boolean {
		return this.#driver.placeAtHandle(handle, boundary)
	}
}