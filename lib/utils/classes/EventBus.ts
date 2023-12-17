import {EventKey, Listener} from '../../types'

export class EventBus {
	readonly #SystemEvents = new Map<EventKey<any>, Set<Listener>>()

	send<T>(key: EventKey<T>, value?: T) {
		this.#getListeners(key).forEach((func) => func(value))
	}

	on<T>(key: EventKey<T>, listener: Listener<T>): () => void {
		this.#getListeners(key).add(listener)
		return () => this.#getListeners(key).delete(listener)
	}

	#getListeners(key: EventKey<any>) {
		if (!this.#SystemEvents.has(key))
			this.#SystemEvents.set(key, new Set())
		return this.#SystemEvents.get(key) as Set<Listener>
	}
}