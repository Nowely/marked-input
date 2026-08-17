import {event, watch} from '../../shared/signals'
import type {DragAction} from '../../shared/types'
import type {EditController} from '../edit'
import type {PropsModel} from '../state/PropsModel'
import type {NodeAnchor, TokenModel, TreeNode} from '../tokens'
import {BlockStore} from './BlockStore'
import {applyDragAction} from './operations'

export class BlockController {
	readonly action = event<DragAction>()

	/**
	 * Per-row UI-state stores keyed by stable node id. A number-keyed Map cannot
	 * self-collect — removed ids are pruned on the changed event below. Keying by the
	 * row OBJECT (the pre-identity WeakMap) reset a row's drag/hover state whenever an
	 * edit above it re-materialized the row; the live node survives such an edit, but
	 * the id is what makes that a rule rather than an adoption detail.
	 */
	readonly #stores = new Map<number, BlockStore>()

	constructor(
		private readonly props: PropsModel,
		private readonly tokens: TokenModel,
		private readonly edit: EditController
	) {
		watch(this.action, action => {
			// `draggable` gates the DRAG UI (the grip's drag affordance), not the actions:
			// menu and keyboard row edits are block-mode features, so block mode alone admits them.
			if (!this.props.layout.isBlock()) return
			// Reorder is drag-originated (grip dragstart / row drop), so it stays behind
			// `draggable`; add/duplicate/delete arrive from the menu or the keyboard.
			if (action.type === 'reorder' && !this.props.draggable()) return
			// A row DELETE is the row's own node leaving the tree, and saying so is what keeps the
			// other rows' identity: composing a new whole document and diffing it back cannot tell
			// two byte-identical rows apart, so `gapWindow` picked the wrong span and the commit
			// announced the WRONG id as removed. Gated by 'removes the addressed row, not a
			// byte-identical neighbour'.
			if (action.type === 'delete') {
				this.tokens.nodes().at(action.index)?.remove()
				return
			}
			// Anchor-slice reads: the tree's own string, always consistent with nodes().
			const read = (from: NodeAnchor, to: NodeAnchor): string => this.tokens.valueBetween(from, to)
			const result = applyDragAction(read, this.tokens.nodes(), action, this.props.options())
			if (result === undefined) return
			this.edit.setValue(result.value, result.caret)
		})

		// The `changed` payload (spec §2.3) replaced a wave-scoped side channel: the
		// ids arrive WITH the event instead of from a field that was valid only for
		// the duration of that wave, and the pipeline merges every commit folded into
		// one paint rather than keeping the last one.
		watch(this.tokens.changed, delta => {
			for (const id of delta.removed) this.#stores.delete(id)
		})
	}

	/** Returns the per-row UI-state store for a row node (keyed by its stable identity id), creating it on first access. */
	get(node: TreeNode): BlockStore {
		const id = node.id
		let store = this.#stores.get(id)
		if (!store) {
			store = new BlockStore()
			this.#stores.set(id, store)
		}
		return store
	}
}