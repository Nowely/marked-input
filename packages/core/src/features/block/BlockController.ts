import {event, watch} from '../../shared/signals'
import type {DragAction} from '../../shared/types'
import type {EditController} from '../edit'
import type {PropsModel} from '../state/PropsModel'
import type {ValueModel} from '../state/ValueModel'
import type {TokenModel} from '../tokens'
import {freshTokens} from '../tokens'
import {BlockStore} from './BlockStore'
import {applyDragAction} from './operations'

export class BlockController {
	readonly action = event<DragAction>()

	readonly #stores = new WeakMap<object, BlockStore>()

	constructor(
		private readonly props: PropsModel,
		private readonly value: ValueModel,
		private readonly tokens: TokenModel,
		private readonly edit: EditController
	) {
		watch(this.action, action => {
			if (!this.props.layout.isBlock() || !this.props.draggable()) return
			const value = this.value.current()
			// Fresh read: drag operations slice the live value by row positions.
			// A plain-text row keeps block typing on the text path, so tree()
			// positions can lag the value at drop time.
			const result = applyDragAction(value, freshTokens(this.tokens), action, this.props.options())
			if (result.value === value) return
			this.edit.replace({start: 0, end: -1}, result.value, result.caret)
		})
	}

	/** Returns the per-row UI-state store for a token, creating it on first access. */
	get(token: object): BlockStore {
		let store = this.#stores.get(token)
		if (!store) {
			store = new BlockStore()
			this.#stores.set(token, store)
		}
		return store
	}
}