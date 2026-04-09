import {
	signal as alienSignal,
	effect as alienEffect,
	computed as alienComputed,
	setActiveSub,
	startBatch,
	endBatch,
} from './alien-signals'
import {getUseHookFactory} from './registry'

export {alienEffect as effect}

// ---------------------------------------------------------------------------
// Signal<T> — reactive state value
// ---------------------------------------------------------------------------

export interface Signal<T> {
	(): T
	(value: T | undefined): void
	get(): T
	set(value: T | undefined): void
	use(): T
}

/**
 * Derives a plain-value object type from an object of signals.
 * `{ foo: Signal<string>, bar: Signal<number> }` → `{ foo: string, bar: number }`
 */
export type SignalValues<T> = {
	[K in keyof T]: T[K] extends Signal<infer V> | Computed<infer V> ? V : never
}

interface SignalOptions<T> {
	equals?: false | ((a: T, b: T) => boolean)
}

export function signal<T>(initial: T, opts?: SignalOptions<T>): Signal<T> {
	const hasCustomEquals = opts?.equals !== undefined

	// When equals is `false` we box the value so every write creates a new reference.
	// When equals is a custom function we wrap the setter to compare manually.
	// oxlint-disable-next-line no-non-null-assertion, no-unnecessary-type-assertion -- opts is defined when hasCustomEquals is true; TS does not narrow opts from the boolean variable
	const equalsOpt = hasCustomEquals ? opts!.equals : undefined
	if (hasCustomEquals && equalsOpt === false) {
		const _default = initial
		const hasDefault = initial !== undefined
		let seq = 0
		const inner = alienSignal<{v: T; seq: number} | undefined>(undefined)

		const read = (): T => {
			const box = inner()
			if (box === undefined) {
				// oxlint-disable-next-line no-unsafe-type-assertion -- when hasDefault is false, T includes undefined so returning undefined is safe
				return hasDefault ? _default : (undefined as T)
			}
			return box.v
		}

		// oxlint-disable-next-line no-unsafe-type-assertion -- callable matches Signal<T> interface but TS can't verify the overloaded call signature
		const callable = function signalCallable(...args: [T | undefined] | []) {
			if (args.length) {
				if (args[0] === undefined) {
					if (hasDefault && inner() === undefined) return
					inner(undefined)
				} else {
					inner({v: args[0], seq: seq++})
				}
			} else {
				return read()
			}
		} as unknown as Signal<T>

		callable.get = () => read()
		callable.set = (v: T | undefined) => {
			if (v === undefined) {
				if (hasDefault && inner() === undefined) return
				inner(undefined)
			} else {
				inner({v, seq: seq++})
			}
		}
		// oxlint-disable-next-line no-unsafe-type-assertion -- UseHookFactory returns () => unknown; framework packages augment use() return type via module augmentation
		callable.use = (() => getUseHookFactory()(callable)()) as Signal<T>['use']
		return callable
	}

	if (hasCustomEquals && typeof equalsOpt === 'function') {
		const equalsFn = equalsOpt
		const _default = initial
		const hasDefault = initial !== undefined
		const inner = alienSignal<T | undefined>(undefined)

		const read = (): T => {
			const v = inner()
			if (v === undefined && hasDefault) return _default
			// oxlint-disable-next-line no-unsafe-type-assertion -- when hasDefault is false, T includes undefined so the cast is safe
			return v as T
		}

		// oxlint-disable-next-line no-unsafe-type-assertion -- callable matches Signal<T> interface but TS can't verify the overloaded call signature
		const callable = function signalCallable(...args: [T | undefined] | []) {
			if (args.length) {
				if (args[0] === undefined) {
					if (hasDefault && inner() === undefined) return
					inner(undefined)
				} else {
					if (!equalsFn(read(), args[0])) {
						inner(args[0])
					}
				}
			} else {
				return read()
			}
		} as unknown as Signal<T>

		callable.get = () => read()
		callable.set = (v: T | undefined) => {
			if (v === undefined) {
				if (hasDefault && inner() === undefined) return
				inner(undefined)
			} else {
				if (!equalsFn(read(), v)) {
					inner(v)
				}
			}
		}
		// oxlint-disable-next-line no-unsafe-type-assertion -- UseHookFactory returns () => unknown; framework packages augment use() return type via module augmentation
		callable.use = (() => getUseHookFactory()(callable)()) as Signal<T>['use']
		return callable
	}

	const _default = initial
	const hasDefault = initial !== undefined
	const inner = alienSignal<T | undefined>(undefined)

	const read = (): T => {
		const v = inner()
		if (v === undefined && hasDefault) return _default
		// oxlint-disable-next-line no-unsafe-type-assertion -- when hasDefault is false, T includes undefined so the cast is safe
		return v as T
	}

	// oxlint-disable-next-line no-unsafe-type-assertion -- callable matches Signal<T> interface but TS can't verify the overloaded call signature
	const callable = function signalCallable(...args: [T | undefined] | []) {
		if (args.length) {
			const v = args[0]
			if (v === undefined && hasDefault) {
				if (inner() === undefined) return
				inner(undefined)
			} else {
				const current = inner()
				const effectiveCurrent = current === undefined && hasDefault ? _default : current
				if (effectiveCurrent !== v) {
					inner(v)
				}
			}
		} else {
			return read()
		}
	} as unknown as Signal<T>

	callable.get = () => read()
	callable.set = (v: T | undefined) => {
		if (v === undefined && hasDefault) {
			if (inner() === undefined) return
			inner(undefined)
		} else {
			const current = inner()
			const effectiveCurrent = current === undefined && hasDefault ? _default : current
			if (effectiveCurrent !== v) {
				inner(v)
			}
		}
	}
	// oxlint-disable-next-line no-unsafe-type-assertion -- UseHookFactory returns () => unknown; framework packages augment use() return type via module augmentation
	callable.use = (() => getUseHookFactory()(callable)()) as Signal<T>['use']
	return callable
}

// ---------------------------------------------------------------------------
// Computed<T> — derived reactive value
// ---------------------------------------------------------------------------

export interface Computed<T> {
	(): T
	get(): T
	use(): T
}

export function computed<T>(getter: (previousValue?: T) => T): Computed<T> {
	const inner = alienComputed(getter)

	// oxlint-disable-next-line no-unsafe-type-assertion -- callable matches Computed<T> interface but TS can't verify the call signature
	const callable = function computedCallable(): T {
		return inner()
	} as unknown as Computed<T>

	callable.get = () => inner()
	// oxlint-disable-next-line no-unsafe-type-assertion -- UseHookFactory returns () => unknown; framework packages augment use() return type via module augmentation
	callable.use = (() => getUseHookFactory()(callable)()) as Computed<T>['use']

	return callable
}

// ---------------------------------------------------------------------------
// Event<T> — unified reactive event primitive
// ---------------------------------------------------------------------------

export interface Event<T = void> {
	/** Read/subscribe — auto-tracks inside effects. Returns latest payload or undefined. */
	(): T | undefined
	/** Emit — always fires even when payload reference is unchanged. */
	emit(payload: T): void
	/** Framework hook bridge. */
	use(): T | undefined
}

export function event<T = void>(): Event<T> {
	let seq = 0
	const inner = alienSignal<{v: T; id: number} | undefined>(undefined)

	// oxlint-disable-next-line no-unsafe-type-assertion -- callable matches Event<T> interface but TS can't verify the call signature
	const callable = function eventCallable() {
		const box = inner()
		return box !== undefined ? box.v : undefined
	} as unknown as Event<T>

	callable.emit = (payload: T) => inner({v: payload, id: ++seq})
	// oxlint-disable-next-line no-unsafe-type-assertion -- getUseHookFactory returns () => unknown; cast to T | undefined is safe by Event<T> contract
	callable.use = () => getUseHookFactory()(callable)() as T | undefined

	return callable
}

// ---------------------------------------------------------------------------
// watch() — skip-first-run helper for event subscriptions
// ---------------------------------------------------------------------------

/**
 * Creates an effect that skips its first execution.
 * Useful for subscribing to signals/events without firing on initial creation.
 * The callback receives `(newValue, oldValue)` on each subsequent run.
 *
 * Accepts a signal, event, or getter function as the dependency source:
 *   watch(store.events.delete, (payload) => { ... })
 *   watch(store.state.name,    (next, prev) => { ... })
 *   watch(() => computed(),    (next, prev) => { ... })  // getter form still valid
 *
 * @param dep - dependency source (signal, event, or getter function)
 * @param fn  - callback invoked on subsequent runs with (newValue, oldValue)
 * @returns dispose function
 */
export function watch<T>(dep: Signal<T>, fn: (newValue: T, oldValue: T | undefined) => void): () => void
export function watch<T>(dep: Event<T>, fn: (newValue: T, oldValue: T | undefined) => void): () => void
export function watch<T>(dep: () => T, fn: (newValue: T, oldValue: T | undefined) => void): () => void
export function watch<T>(
	dep: Signal<T> | Event<T> | (() => T),
	fn: (newValue: T, oldValue: T | undefined) => void
): () => void {
	let initialized = false
	let oldValue: T | undefined
	return alienEffect(() => {
		// oxlint-disable-next-line no-unsafe-type-assertion -- Event<T> returns T | undefined before first emit, but watch skips the first run so callback always receives T
		const newValue = dep() as T
		if (!initialized) {
			initialized = true
			oldValue = newValue
			return
		}
		const prev = oldValue
		oldValue = newValue
		const prevSub = setActiveSub(undefined)
		try {
			fn(newValue, prev)
		} finally {
			setActiveSub(prevSub)
		}
	})
}

// ---------------------------------------------------------------------------
// batch() — defer effect flush until callback completes
// ---------------------------------------------------------------------------

export function batch(fn: () => void): void {
	startBatch()
	try {
		fn()
	} finally {
		endBatch()
	}
}