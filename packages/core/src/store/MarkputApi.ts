import type {Host} from '../features/state/Host'
import type {PropsModel} from '../features/state/PropsModel'
import {annotate} from '../features/tokens'
import type {Id, MarkNode, NodeAnchor, TextNode, TokenDelta, TokenModel, TreeNode} from '../features/tokens'
import type {Markup} from '../features/tokens/parser/types'
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
 * It owns nothing. Every member lowers onto a state owner — the token layer, which owns the
 * tree, the DOM binding and (since S2.9) the selection — so the shape of the API can move
 * without moving state (AGENTS.md's one-owner rule).
 */
export class MarkputApi {
	constructor(
		private readonly host: Host,
		private readonly props: PropsModel,
		private readonly tokens: TokenModel
	) {}

	get container(): HTMLElement | null {
		return this.host.container()
	}

	/**
	 * The string projection (spec D1): controlled → the props value, uncontrolled → the last
	 * committed `join(tree)`. A delegation to {@link TokenModel.value}, and deliberately not
	 * `join(tree)` inline — the two disagree while a controlled parent's `props.value` is
	 * ahead of the last arrival, and on an UNSEEDED store, where the tree has no roots at all
	 * but `value()` already answers the seed.
	 *
	 * RECORDED GAP (measured): swapping in `joinNodes(this.tokens.nodes())` survives the whole
	 * suite (73 files, 1326 passed). Every fixture here reaches the verb through a mounted,
	 * seeded store, and an arrival is synchronous on the props watch, so the two readings agree
	 * at every moment a test can observe. Closing it takes an UNMOUNTED-store case, which this
	 * spec's mounted fixture cannot express.
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
	 * `changed`). `'caret'` means the selection's START in document order and yields
	 * `undefined` when there is no selection (spec §2.3).
	 */
	insertMark(at: NodeAnchor | 'caret', init: MarkInit): MarkNode | undefined {
		const anchor = at === 'caret' ? this.tokens.selection.caretAnchor() : at
		if (anchor === undefined || !this.#live(anchor)) return undefined
		const text = annotate(init.markup, {value: init.value, meta: init.meta, slot: init.slot})
		const caret = this.tokens.replaceBetween(anchor, anchor, text)
		if (!caret) return undefined
		if (this.props.value() !== undefined) return undefined
		// A zero-width splice puts the caret at the END of the annotation, so the mark it
		// created is the one ENDING there. That keeps the lookup POSITIONAL — a result feed
		// would mean threading a `TransactionResult` through four sites for one caller — while
		// leaving the arithmetic in `tree/`, which is what `markStartingAt` could not do.
		return this.tokens.adjacentMark(caret, -1)
	}

	replaceText(target: {node: TextNode; start: number; end: number}, text: string): boolean {
		return this.tokens.applyText(target.node, {start: target.start, end: target.end}, text)
	}

	/** Cross-node (spec D5). The pair is normalized, so `from` after `to` is legal. */
	replaceRange(from: NodeAnchor, to: NodeAnchor, text: string): boolean {
		if (!this.#live(from) || !this.#live(to)) return false
		return this.tokens.replaceBetween(from, to, text) !== undefined
	}

	/** Whole-value. Rides the same gap narrowing every whole-value site does (spec D8). */
	setValue(text: string): boolean {
		return this.tokens.setValue(text)
	}

	tx(fn: () => void): boolean {
		return this.tokens.tx(fn)
	}

	focus(): void {
		this.tokens.focusFirst()
	}

	/** The STORED anchors (spec D7), not the derived numbers. Reactive. */
	selection(): {anchor: NodeAnchor; head: NodeAnchor} | undefined {
		return this.tokens.selection.anchors()
	}

	select(anchor: NodeAnchor, head: NodeAnchor = anchor): boolean {
		if (!this.#live(anchor) || !this.#live(head)) return false
		this.tokens.selection.select(anchor, head)
		return true
	}

	caret(at: NodeAnchor): boolean {
		return this.select(at)
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