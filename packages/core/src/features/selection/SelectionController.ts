// packages/core/src/features/selection/SelectionController.ts
import type {Range, RawSelection} from '../../shared/editorContracts'
import type {Computed, Signal} from '../../shared/signals'
import type {Host} from '../state/Host'
import type {PropsModel} from '../state/PropsModel'
import {createSelection, SelectionDriver} from '../tokens'
import type {Anchors, NodeAnchor, Selection, TokenHandle, TokenModel, TransactionResult} from '../tokens'

/**
 * The selection seam, and nothing more: {@link Selection} holds the tree-space state and
 * {@link SelectionDriver} owns the DOM I/O over it. Both live in the token layer; this
 * class only composes them, because `Store` constructs the selection while `TokenModel`
 * keeps its tree private.
 */
export class SelectionController {
	readonly range: Computed<Range | undefined>
	readonly position: Signal<number | undefined>
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
			current: () => tokens.current(),
			find: id => tokens.find(id),
			handleAt: node => tokens.handleAt(node),
			handle: id => tokens.handle(id),
			handleOf: token => tokens.handleOf(token),
			domSelection: () => tokens.selection(),
			setEditable: options => tokens.setEditable(options),
			placeCaret: rawPosition => tokens.placeCaret(rawPosition),
			selectRange: (start, end) => tokens.selectRange(start, end),
			offsetOf: anchor => tokens.offsetOf(anchor),
			anchorFor: (node, offset, affinity) => tokens.anchorFor(node, offset, affinity),
		})

		this.range = this.#state.range
		this.position = this.#state.position
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

	/** @internal See {@link Selection.repair} — the `SelectionPort` half `TokenModel` calls. */
	repair(result: TransactionResult): void {
		this.#state.repair(result)
	}

	/** Spec §2.3's `input.selection()`: the STORED anchors (spec S1 D7). */
	anchors(): Anchors | undefined {
		return this.#state.anchors()
	}

	focusFirst(): void {
		this.#driver.focusFirst()
	}

	readRaw(): RawSelection | undefined {
		return this.#driver.readRaw()
	}

	placeAtHandle(handle: TokenHandle, boundary: 'start' | 'end' = 'start'): boolean {
		return this.#driver.placeAtHandle(handle, boundary)
	}
}