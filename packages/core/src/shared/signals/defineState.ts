import {startBatch, endBatch} from './alien-signals'
import {signal} from './signal'
import type {Signal} from './signal'

export type StateObject<T> = {
	[K in keyof T]: Signal<T[K]>
} & {
	set(values: Partial<T>): void
}

export function defineState<T extends object>(
	initial: T,
	opts?: {equals?: {[K in keyof T]?: false | ((a: T[K], b: T[K]) => boolean)}}
): StateObject<T> {
	// oxlint-disable-next-line no-explicit-any, no-unsafe-type-assertion -- heterogeneous map: per-key signal types reconstructed by StateObject<T>
	const signals = {} as Record<string, Signal<any>>

	for (const key in initial) {
		if (Object.prototype.hasOwnProperty.call(initial, key)) {
			const equals = opts?.equals?.[key]
			signals[key] = signal(initial[key], equals !== undefined ? {equals} : undefined)
		}
	}

	// oxlint-disable-next-line no-unsafe-type-assertion -- Object.create(null) produces an object; properties are defined below via defineProperty
	const state = Object.create(null) as StateObject<T>

	for (const key in signals) {
		Object.defineProperty(state, key, {
			get: () => signals[key],
			enumerable: true,
		})
	}

	Object.defineProperty(state, 'set', {
		value: (values: Partial<T>) => {
			startBatch()
			try {
				for (const k in values) {
					const sig = signals[k]
					// oxlint-disable-next-line no-unnecessary-condition -- sig may be undefined when values contains keys not present in the initial state
					if (sig) {
						// oxlint-disable-next-line no-unsafe-type-assertion -- heterogeneous value map: k is keyof Partial<T> so values[k] satisfies the signal's type at runtime
						sig(values[k] as never)
					}
				}
			} finally {
				endBatch()
			}
		},
		enumerable: false,
	})

	return state
}