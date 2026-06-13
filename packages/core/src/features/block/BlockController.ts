import {event, watch} from '../../shared/signals'
import type {DragAction} from '../../shared/types'
import type {EditController} from '../edit'
import type {PropsModel} from '../state/PropsModel'
import type {ValueModel} from '../state/ValueModel'
import type {Token, TokenModel} from '../tokens'
import {BlockStore} from './BlockStore'
import {applyDragAction} from './operations'

export class BlockController {
	readonly action = event<DragAction>()

	/**
	 * Per-row UI-state stores keyed by stable token id: a row suffix-shifted by
	 * an edit above it is a NEW object with an INHERITED id, so object keying
	 * (the old WeakMap) silently reset its drag/hover state. A number-keyed Map
	 * cannot self-collect — removed ids are pruned on the changed event below.
	 */
	readonly #stores = new Map<number, BlockStore>()

	constructor(
		private readonly props: PropsModel,
		private readonly value: ValueModel,
		private readonly tokens: TokenModel,
		private readonly edit: EditController
	) {
		watch(this.action, action => {
			if (!this.props.layout.isBlock() || !this.props.draggable()) return
			const value = this.value.current()
			// Fresh read: drag operations slice the live value by row positions;
			// tokens() is the reconciled tree consistent with value.current() at
			// drop time.
			const result = applyDragAction(value, this.tokens.tokens(), action, this.props.options())
			if (result.value === value) return
			this.edit.replace({start: 0, end: -1}, result.value, result.caret)
		})

		// changed is payloadless (Phase 2); the removed ids of the last commit
		// come from the model's removedIds() accessor — the prune feed.
		watch(this.tokens.changed, () => {
			for (const id of this.tokens.removedIds()) this.#stores.delete(id)
		})
	}

	/** Returns the per-row UI-state store for a token (keyed by its stable identity id), creating it on first access. */
	get(token: Token): BlockStore {
		const id = this.tokens.keyOf(token)
		let store = this.#stores.get(id)
		if (!store) {
			store = new BlockStore()
			this.#stores.set(id, store)
		}
		return store
	}
}