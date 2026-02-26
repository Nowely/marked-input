export class Signal<T> {
	#value: T
	#subscribers = new Set<(value: T) => void>()

	constructor(value: T) {
		this.#value = value
	}

	get(): T {
		return this.#value
	}

	set(value: T): void {
		if (this.#value !== value) {
			this.#value = value
			this.#subscribers.forEach(cb => cb(value))
		}
	}

	subscribe(callback: (value: T) => void): () => void {
		this.#subscribers.add(callback)
		return () => this.#subscribers.delete(callback)
	}
}
