import {Listener, Type} from '../types'

export class EventBus {
	readonly #SystemEvents = new Map<Type, Set<Listener>>()

	//TODO type
	send(event: Type, arg?: any) {
		this.#getListeners(event).forEach((func) => func(arg))
	}

	listen(event: Type, listener: Listener): () => void {
		this.#getListeners(event).add(listener)
		return () => this.#getListeners(event).delete(listener)
	}

	#getListeners(event: Type) {
		if (!this.#SystemEvents.has(event))
			this.#SystemEvents.set(event, new Set())
		return this.#SystemEvents.get(event) as Set<Listener>
	}
}