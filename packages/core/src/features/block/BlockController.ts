import {event, watch} from '../../shared/signals'
import type {DragAction} from '../../shared/types'
import type {PropsModel} from '../state/PropsModel'
import type {NodeAnchor, TokenModel, TreeNode} from '../tokens'
import {BlockStore} from './BlockStore'
import {createRowContent} from './createRowContent'
import {addRowUnanchored} from './operations'

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
		private readonly tokens: TokenModel
	) {
		watch(this.action, action => {
			// `draggable` gates the DRAG UI (the grip's drag affordance), not the actions:
			// menu and keyboard row edits are block-mode features, so block mode alone admits them.
			if (!this.props.layout.isBlock()) return
			// Reorder is drag-originated (grip dragstart / row drop), so it stays behind
			// `draggable`; add/duplicate/delete arrive from the menu or the keyboard.
			if (action.type === 'reorder') {
				if (!this.props.draggable()) return
				// The drop target names a SLOT BETWEEN rows, so a target below the source shifts down
				// by one once the row leaves its old place. Both drag no-ops — dropping on itself, and
				// dropping on its own trailing edge — collapse onto `to === from`, which `movePlan`
				// already refuses, so the old `isApplicable` reorder rule is subsumed rather than
				// restated here.
				if (action.source < 0) return
				const to = action.target > action.source ? action.target - 1 : action.target
				this.tokens.nodes().at(action.source)?.moveTo(to)
				return
			}
			// Row DELETE and DUPLICATE are the row's own node speaking, and saying so is what keeps
			// the other rows' identity: composing a new whole document and diffing it back cannot
			// tell two byte-identical rows apart, so `gapWindow` picked the wrong span and the
			// commit announced the WRONG id as removed.
			//
			// The `index >= 0` guards are not decoration: `Array.prototype.at` WRAPS on a negative
			// index, so `at(-1)` would address the LAST row where the composed path wrote nothing.
			const rows = this.tokens.nodes()
			if (action.type === 'delete') {
				if (action.index >= 0) rows.at(action.index)?.remove()
				return
			}
			if (action.type === 'duplicate') {
				if (action.index >= 0) rows.at(action.index)?.duplicate()
				return
			}
			if (rows.length > 0 && action.afterIndex >= 0) {
				// `afterIndex` past the end appends after the LAST row, matching the composer's
				// `Math.min(afterIndex + 1, texts.length)`.
				rows.at(Math.min(action.afterIndex, rows.length - 1))?.insertAfter(
					createRowContent(this.props.options())
				)
				return
			}
			// Anchor-slice reads: the tree's own string, always consistent with nodes().
			const read = (from: NodeAnchor, to: NodeAnchor): string => this.tokens.valueBetween(from, to)
			const result = addRowUnanchored(read, rows, action.afterIndex, this.props.options())
			this.tokens.setValueEnteringRoot(result.value, result.row)
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