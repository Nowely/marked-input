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

	get(): T {
		return this.#value
	}

	set(value: T): void {
		if (this.#equals === false || !this.#equals(this.#value, value)) {
			this.#value = value
			this.#subs.forEach(fn => fn(value))
		}
	}

	emit(value?: T): void {
		if (arguments.length > 0) {
			this.#value = value as T
		}
		this.#subs.forEach(fn => fn(this.#value))
	}

	subscribe(fn: (v: T) => void): () => void {
		this.#subs.add(fn)
		return () => this.#subs.delete(fn)
	}
}

export function createReactiveProxy<T extends Record<string, Reactive<any>>>(
	reactives: T
): {[K in keyof T]: T[K] extends Reactive<infer V> ? V : never} {
	return new Proxy({} as any, {
		get: (_, prop: string) => reactives[prop as keyof T]?.get(),
		set: (_, prop: string, value) => {
			reactives[prop as keyof T]?.set(value)
			return true
		},
	})
}
