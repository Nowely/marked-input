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
	 * Per-row UI-state stores keyed by the row NODE. Object keying is exactly as stable
	 * as id keying here, and that is a property of adoption rather than a hope: a node's
	 * `id` is allocated once, inside `buildNode`, from a counter private to the one tree
	 * a `TokenModel` ever builds — so within an input instance an id is carried by one
	 * object forever, and "kept its id" and "kept its object" are the same statement.
	 * Adoption writes surviving nodes in place, so an edit above a row no longer
	 * re-materializes it (the pre-identity WeakMap predates that).
	 *
	 * Keying on the object also makes the map self-collecting, which is why there is no
	 * prune: a number-keyed Map could only shed a dead row on an announcement,
	 * and that announcement needs a mounted container — an unmounted or never-bound row
	 * leaked its store for the lifetime of the input.
	 */
	readonly #stores = new WeakMap<TreeNode, BlockStore>()

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
	}

	/** Returns the per-row UI-state store for a row node, creating it on first access. */
	get(node: TreeNode): BlockStore {
		let store = this.#stores.get(node)
		if (!store) {
			store = new BlockStore()
			this.#stores.set(node, store)
		}
		return store
	}
}