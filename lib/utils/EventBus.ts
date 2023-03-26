import {Listener, SystemEvent} from '../types'

export class EventBus {
	readonly #SystemEvents = new Map<SystemEvent, Set<Listener>>()

	//TODO type
	send(event: SystemEvent, arg?: any) {
		this.#getListeners(event).forEach((func) => func(arg))
	}

	listen(event: SystemEvent, listener: Listener): () => void {
		this.#getListeners(event).add(listener)
		return () => this.#getListeners(event).delete(listener)
	}

	#getListeners(event: SystemEvent) {
		if (!this.#SystemEvents.has(event))
			this.#SystemEvents.set(event, new Set())
		return this.#SystemEvents.get(event) as Set<Listener>
	}
}