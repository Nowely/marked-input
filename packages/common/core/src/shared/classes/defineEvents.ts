import {Reactive} from './Reactive'

export type Emitter<T = void> = {
	(payload?: T): void
	on(fn: (value: T) => void): () => void
}

function createEmitter<T>(reactive: Reactive<T | undefined>): Emitter<T> {
	const emitter = function (payload?: T): void {
		reactive.emit(payload)
	} as Emitter<T>

	emitter.on = (fn: (value: T) => void) => reactive.on(fn as (value: T | undefined) => void)

	return emitter
}

type EventSchema = Record<string, unknown>

export function defineEvents<T extends EventSchema>(schema?: T): {[K in keyof T]: Emitter<T[K]>} {
	const keys = schema ? (Object.keys(schema) as (keyof T)[]) : []
	// eslint-disable-next-line typescript-eslint/no-explicit-any -- heterogeneous map: Proxy reconstructs per-key types
	const reactives = new Map<string, Reactive<any>>()

	for (const key of keys) {
		reactives.set(key as string, Reactive.event())
	}

	return new Proxy({} as T, {
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