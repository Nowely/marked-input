type EqualsFn<T> = (a: T, b: T) => boolean

const defaultEquals = <T>(a: T, b: T): boolean => a === b

export class Reactive<T = void> {
	#value: T
	#subs = new Set<(v: T) => void>()
	#equals: false | EqualsFn<T>

	constructor(initial: T, options?: {equals?: false | EqualsFn<T>}) {
		this.#value = initial
		this.#equals = options?.equals ?? defaultEquals
	}

	static event<T = void>(): Reactive<T | undefined> {
		return new Reactive<T | undefined>(undefined, {equals: false})
	}

	get value(): T {
		return this.#value
	}

	set value(val: T) {
		if (this.setSilent(val)) {
			this.notify()
		}
	}

	on(fn: (v: T) => void): () => void {
		this.#subs.add(fn)
		return () => this.#subs.delete(fn)
	}

	emit(value?: T): void {
		if (arguments.length > 0) {
			this.#value = value as T
		}
		this.#subs.forEach(fn => fn(this.#value))
	}

	get(): T {
		return this.#value
	}

	set(value: T): void {
		this.value = value
	}

	setSilent(val: T): boolean {
		if (this.#equals === false || !this.#equals(this.#value, val)) {
			this.#value = val
			return true
		}
		return false
	}

	notify(): void {
		this.#subs.forEach(fn => fn(this.#value))
	}
}