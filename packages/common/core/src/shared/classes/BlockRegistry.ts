import {BlockStore} from './BlockStore'
import type {UseHookFactory} from './defineState'

export class BlockRegistry {
	readonly #map = new WeakMap<object, BlockStore>()
	readonly #createUseHook: UseHookFactory

	constructor(createUseHook: UseHookFactory) {
		this.#createUseHook = createUseHook
	}

	get(token: object): BlockStore {
		let store = this.#map.get(token)
		if (!store) {
			store = new BlockStore(this.#createUseHook)
			this.#map.set(token, store)
		}
		return store
	}
}