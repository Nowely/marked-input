import {Reactive} from './Reactive'

export type Emitter<T = void> = {
	(payload?: T): void
	on(fn: (value: T) => void): () => void
}

function createEmitter<T>(reactive: Reactive<T | undefined>): Emitter<T> {
	return Object.assign(
		(payload?: T): void => {
			reactive.emit(payload)
		},
		{
			on: (fn: (value: T) => void) => reactive.on(fn as (v: T | undefined) => void),
		}
	)
}

type EventSchema = Record<string, unknown>

export function defineEvents<T extends EventSchema>(schema?: T): {[K in keyof T]: Emitter<T[K]>} {
	const keys = schema ? (Object.keys(schema) as (keyof T)[]) : []
	// eslint-disable-next-line typescript-eslint/no-explicit-any -- heterogeneous map: Proxy reconstructs per-key types
	const reactives = new Map<string, Reactive<any>>()

	for (const key of keys) {
		// oxlint-disable-next-line no-unsafe-type-assertion -- key is keyof T where T extends Record<string, unknown>, so it is always a string
		reactives.set(key as string, Reactive.event())
	}

	const target: object = {}
	// oxlint-disable-next-line no-unsafe-type-assertion -- typed Proxy pattern; target is a dummy object, return type is the mapped schema
	return new Proxy(target, {
		get(_, key: string) {
			let reactive = reactives.get(key)
			if (!reactive) {
				reactive = Reactive.event()
				reactives.set(key, reactive)
			}

			return createEmitter(reactive)
		},
	}) as {[K in keyof T]: Emitter<T[K]>}
}