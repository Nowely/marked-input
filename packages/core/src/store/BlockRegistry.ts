import {BlockStore} from './BlockStore'

export class BlockRegistry {
	readonly #map = new WeakMap<object, BlockStore>()

	get(token: object): BlockStore {
		let store = this.#map.get(token)
		if (!store) {
			store = new BlockStore()
			this.#map.set(token, store)
		}
		return store
	}
}