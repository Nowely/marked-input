import {EventKey, Listener} from '../../types'

export class EventBus {
	readonly #SystemEvents = new Map<EventKey<any>, Set<Listener>>()

	send<K extends EventKey<T>, T>(key: K, value?: T) {
		this.#getListeners(key).forEach((func) => func(value))
	}

	on<K extends EventKey<T>, T>(key: K, listener: Listener<T>): () => void {
		this.#getListeners(key).add(listener)
		return () => this.#getListeners(key).delete(listener)
	}

	#getListeners(key: EventKey<any>) {
		if (!this.#SystemEvents.has(key))
			this.#SystemEvents.set(key, new Set())
		return this.#SystemEvents.get(key) as Set<Listener>
	}
}