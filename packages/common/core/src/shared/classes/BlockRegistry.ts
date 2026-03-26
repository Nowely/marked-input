import {BlockStore} from './BlockStore'
import type {UseHookFactory} from './defineState'

export class BlockRegistry {
	readonly #map = new WeakMap<object, BlockStore>()
	readonly #createUseHook: UseHookFactory

	constructor(createUseHook: UseHookFactory) {
		this.#createUseHook = createUseHook
	}

	get(token: object): BlockStore {
		if (!this.#map.has(token)) {
			this.#map.set(token, new BlockStore(this.#createUseHook))
		}
		return this.#map.get(token)!
	}
}