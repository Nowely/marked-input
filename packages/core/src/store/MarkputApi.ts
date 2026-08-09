import type {SelectionController} from '../features/selection/SelectionController'
import type {Host} from '../features/state/Host'
import type {PropsModel} from '../features/state/PropsModel'
import {annotate} from '../features/tokens'
import type {Id, MarkNode, NodeAnchor, TextNode, TokenModel, TreeNode} from '../features/tokens'
import type {TokenDelta} from '../features/tokens/model/commitInput'
import type {Markup} from '../features/tokens/parser/types'
import type {Range} from '../shared/editorContracts'
import type {Event} from '../shared/signals'

/** Spec §2.3's `insertMark` initializer. */
export type MarkInit = {
	readonly markup: Markup
	readonly value: string
	readonly meta?: string
	readonly slot?: string
}

/**
 * THE public surface (spec §2.3). The evolved `MarkputHandler`: it keeps `container`,
 * absorbs `focus()`, drops the consumer-free `overlay` getter, and gains the live node
 * reads, the model-centric write verbs, node-anchored selection and the `changed` payload.
 *
 * It owns nothing. Every member lowers onto a state owner — the token layer for reads and
 * writes, the selection controller for anchors — so the shape of the API can move without
 * moving state (AGENTS.md's one-owner rule).
 */
export class MarkputApi {
	constructor(
		private readonly host: Host,
		private readonly props: PropsModel,
		private readonly tokens: TokenModel,
		/**
		 * NAMED `selectionController`, not `selection`: this class has a
		 * `selection(): {anchor, head} | undefined` method, and TypeScript rejects a parameter
		 * property colliding with a member (TS2300) — the same collision `TokenModel`
		 * documents for its own `selectionPort`.
		 */
		private readonly selectionController: SelectionController
	) {}

	get container(): HTMLElement | null {
		return this.host.container()
	}

	/**
	 * The string projection (spec D1): controlled → the props value, uncontrolled → the last
	 * committed `join(tree)`. A delegation to {@link TokenModel.value}, and deliberately not
	 * `join(tree)` inline — the two disagree while a controlled parent's `props.value` is
	 * ahead of the last arrival. (Gated: swapping in `joinNodes(nodes())` fails 9 core tests.)
	 */
	value(): string {
		return this.tokens.value()
	}

	/** The live root nodes, reactive (spec §2.3, D11). Ids are always present. */
	nodes(): readonly TreeNode[] {
		return this.tokens.nodes()
	}

	find(id: Id): TreeNode | undefined {
		return this.tokens.find(id)
	}

	/** Fires once per commit, after the DOM is consistent (spec §2.3; D9's fold merging). */
	get changed(): Event<TokenDelta> {
		return this.tokens.changed
	}

	/**
	 * Returns the fresh node in uncontrolled mode and `undefined` in controlled mode (spec D6:
	 * the node exists only once the parent's echo commits — a caller re-finds it from
	 * `changed`). The uncontrolled lookup is BY POSITION rather than through a result feed:
	 * `applyRange` answers a boolean and the `TransactionResult` goes to the boundary, so
	 * threading one out would touch four sites for one caller. The parse of the spliced
	 * projection puts the mark exactly at the insertion offset (plan decision D-g).
	 */
	insertMark(at: NodeAnchor | 'caret', init: MarkInit): MarkNode | undefined {
		const offset = this.#offsetOf(at)
		if (offset === undefined) return undefined
		const text = annotate(init.markup, {value: init.value, meta: init.meta, slot: init.slot})
		if (!this.tokens.replace({start: offset, end: offset}, text)) return undefined
		if (this.props.value() !== undefined) return undefined
		return markStartingAt(this.tokens.nodes(), offset)
	}

	replaceText(target: {node: TextNode; start: number; end: number}, text: string): boolean {
		return this.tokens.applyText(target.node, {start: target.start, end: target.end}, text)
	}

	/** Cross-node (spec D5). The pair is normalized, so `from` after `to` is legal. */
	replaceRange(from: NodeAnchor, to: NodeAnchor, text: string): boolean {
		const a = this.#offsetOf(from)
		const b = this.#offsetOf(to)
		if (a === undefined || b === undefined) return false
		return this.tokens.replace({start: Math.min(a, b), end: Math.max(a, b)}, text)
	}

	/**
	 * Whole-value. Rides the internal offset shim's gap narrowing (spec D8), like every other
	 * whole-value site — which is what the `-1` sentinel selects.
	 *
	 * RECORDED GAP (measured): passing `{0, this.value().length}` instead survives the whole
	 * suite. The two take the same `lowerReplace` branch whenever the props value and the tree
	 * projection agree, and an arrival is synchronous on the props watch, so they agree at
	 * every observable moment. Kept as the sentinel because it is the tree's own length by
	 * construction rather than a read of a value that is props-first in controlled mode.
	 */
	setValue(text: string): boolean {
		return this.tokens.replace({start: 0, end: -1}, text)
	}

	tx(fn: () => void): boolean {
		return this.tokens.tx(fn)
	}

	focus(): void {
		this.selectionController.focusFirst()
	}

	/** The STORED anchors (spec D7), not the derived numbers. Reactive. */
	selection(): {anchor: NodeAnchor; head: NodeAnchor} | undefined {
		return this.selectionController.anchors()
	}

	select(anchor: NodeAnchor, head: NodeAnchor = anchor): boolean {
		if (!this.#live(anchor) || !this.#live(head)) return false
		this.selectionController.select(anchor, head)
		return true
	}

	caret(at: NodeAnchor): boolean {
		return this.select(at)
	}

	selectionRange(): Range | undefined {
		return this.selectionController.range()
	}

	/** `'caret'` yields `undefined` when there is no selection (spec §2.3). */
	#offsetOf(anchor: NodeAnchor | 'caret'): number | undefined {
		if (anchor === 'caret') return this.selectionController.range()?.start
		if (!this.#live(anchor)) return undefined
		return this.tokens.offsetOf(anchor)
	}

	/**
	 * An anchor naming a node from a previous generation is REJECTED rather than silently
	 * resolved (plan decision D-f): its stored `position` is whatever adoption last wrote
	 * before the node left the tree, so resolving it would splice at an arbitrary offset. The
	 * document edges are always live.
	 */
	#live(anchor: NodeAnchor): boolean {
		if (typeof anchor === 'string') return true
		const node = 'node' in anchor ? anchor.node : 'before' in anchor ? anchor.before : anchor.after
		return this.tokens.find(node.id) === node
	}
}

/** The mark a splice just created: the parse puts it exactly at the insertion offset. */
function markStartingAt(nodes: readonly TreeNode[], offset: number): MarkNode | undefined {
	for (const node of nodes) {
		if (node.kind !== 'mark') continue
		if (node.position.start === offset) return node
		const found = markStartingAt(node.children(), offset)
		if (found) return found
	}
	return undefined
}