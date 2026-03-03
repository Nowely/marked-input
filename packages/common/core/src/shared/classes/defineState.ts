import {Reactive} from './Reactive'

/**
 * Framework adapters can return any reactive wrapper from `use`.
 * React returns plain values, while Vue can return `Ref<T>`.
 */
export type UseHookFactory = <T>(signal: Signal<T>) => () => any

export type Signal<T> = {
	get(): T
	set(value: T): void
	on(fn: (value: T) => void): () => void
	use: () => T
}

function createSignal<T>(reactive: Reactive<T>, createUseHook: UseHookFactory): Signal<T> {
	const signal = {} as Signal<T>
	signal.get = () => reactive.get()
	signal.set = (value: T) => reactive.set(value)
	signal.on = (fn: (value: T) => void) => reactive.on(fn)
	signal.use = createUseHook(signal)

	return signal
}

export type StateObject<T> = {
	[K in keyof T]: Signal<T[K]>
} & {
	set(values: Partial<T>): void
}

export function defineState<T extends object>(initial: T, createUseHook: UseHookFactory): StateObject<T> {
	const reactives = new Map<string, Reactive<any>>()

	for (const key in initial) {
		reactives.set(key, new Reactive(initial[key]))
	}

	return new Proxy(initial, {
		get(_, key: string) {
			if (key === 'set') {
				return (values: Partial<T>) => {
					for (const k in values) {
						reactives.get(k)?.set(values[k])
					}
				}
			}
			const reactive = reactives.get(key)
			if (!reactive) return undefined

			return createSignal(reactive, createUseHook)
		},
	}) as StateObject<T>
}
