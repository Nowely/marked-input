import {Reactive} from './Reactive'

export type Signal<T> = {
	(): T
	(value: T): void
	on(fn: (value: T) => void): () => void
}

function createSignal<T>(reactive: Reactive<T>): Signal<T> {
	const signal = function (value?: T): T | void {
		if (arguments.length === 0) {
			return reactive.get()
		}
		reactive.set(value as T)
	} as Signal<T>

	signal.on = (fn: (value: T) => void) => reactive.on(fn)

	return signal
}

export function defineState<T extends Record<string, unknown>>(initial: T): {[K in keyof T]: Signal<T[K]>} {
	const reactives = new Map<string, Reactive<any>>()

	for (const key in initial) {
		reactives.set(key, new Reactive(initial[key]))
	}

	return new Proxy(initial, {
		get(_, key: string) {
			const reactive = reactives.get(key)
			if (!reactive) return undefined

			return createSignal(reactive)
		},
	}) as {[K in keyof T]: Signal<T[K]>}
}
