import {event, watch} from '../../shared/signals'
import type {DragAction} from '../../shared/types'
import type {EditController} from '../edit'
import type {PropsModel} from '../state/PropsModel'
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
		private readonly tokens: TokenModel,
		private readonly edit: EditController
	) {
		watch(this.action, action => {
			if (!this.props.layout.isBlock() || !this.props.draggable()) return
			const value = this.tokens.value()
			// Fresh read: drag operations slice the live value by row positions;
			// tokens() is the reconciled tree consistent with value.current() at
			// drop time.
			const result = applyDragAction(value, this.tokens.current(), action, this.props.options())
			if (result.value === value) return
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