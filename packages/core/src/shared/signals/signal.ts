import {signal as alienSignal, effect as alienEffect, getActiveSub} from '../alien-signals/src/index.js'

export {alienEffect as effect}
import {getUseHookFactory} from './registry.js'

// ---------------------------------------------------------------------------
// Signal<T> — reactive state value
// ---------------------------------------------------------------------------

export interface Signal<T> {
	/** Read current value (auto-tracks inside effects). */
	(): T
	/** Write a new value. */
	(value: T): void
	/** Read alias (compat). */
	get(): T
	/** Write alias (compat). */
	set(value: T): void
	/** Framework hook bridge. */
	use(): T
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
		// Always-fire mode: box each value so alien-signals' !== always sees a new ref
		let seq = 0
		const inner = alienSignal<{v: T; seq: number}>({v: initial, seq: seq++})

		// oxlint-disable-next-line no-unsafe-type-assertion -- callable matches Signal<T> interface but TS can't verify the overloaded call signature
		const callable = function signalCallable(...args: [T] | []) {
			if (args.length) {
				inner({v: args[0], seq: seq++})
			} else {
				return inner().v
			}
		} as unknown as Signal<T>

		callable.get = () => inner().v
		callable.set = (v: T) => inner({v, seq: seq++})
		// oxlint-disable-next-line no-unsafe-type-assertion -- UseHookFactory returns () => unknown; framework packages augment use() return type via module augmentation
		callable.use = (() => getUseHookFactory()(callable)()) as Signal<T>['use']
		return callable
	}

	if (hasCustomEquals && typeof equalsOpt === 'function') {
		// Custom equals: wrap setter to skip when equal
		const equalsFn = equalsOpt
		const inner = alienSignal<T>(initial)

		// oxlint-disable-next-line no-unsafe-type-assertion -- callable matches Signal<T> interface but TS can't verify the overloaded call signature
		const callable = function signalCallable(...args: [T] | []) {
			if (args.length) {
				if (!equalsFn(inner(), args[0])) {
					inner(args[0])
				}
			} else {
				return inner()
			}
		} as unknown as Signal<T>

		callable.get = () => inner()
		callable.set = (v: T) => {
			if (!equalsFn(inner(), v)) {
				inner(v)
			}
		}
		// oxlint-disable-next-line no-unsafe-type-assertion -- UseHookFactory returns () => unknown; framework packages augment use() return type via module augmentation
		callable.use = (() => getUseHookFactory()(callable)()) as Signal<T>['use']
		return callable
	}

	// Default: alien-signals' built-in !== equality
	const inner = alienSignal<T>(initial)

	// oxlint-disable-next-line no-unsafe-type-assertion -- callable matches Signal<T> interface but TS can't verify the overloaded call signature
	const callable = function signalCallable(...args: [T] | []) {
		if (args.length) {
			inner(args[0])
		} else {
			return inner()
		}
	} as unknown as Signal<T>

	callable.get = () => inner()
	callable.set = (v: T) => inner(v)
	// oxlint-disable-next-line no-unsafe-type-assertion -- UseHookFactory returns () => unknown; framework packages augment use() return type via module augmentation
	callable.use = (() => getUseHookFactory()(callable)()) as Signal<T>['use']
	return callable
}

// ---------------------------------------------------------------------------
// VoidEvent — zero-payload event
// ---------------------------------------------------------------------------

export interface VoidEvent {
	/** Inside an effect: subscribes (reads counter). Outside: emits (increments counter). */
	(): void
	/** Framework hook bridge (mostly unused for events). */
	use(): void
}

export function voidEvent(): VoidEvent {
	const counter = alienSignal(0)

	// oxlint-disable-next-line no-unsafe-type-assertion -- callable matches VoidEvent interface but TS can't verify the conditional call signature
	const callable = function voidEventCallable() {
		if (getActiveSub() !== undefined) {
			// Inside an effect — read to subscribe
			counter()
		} else {
			// Outside an effect — write to emit
			counter(counter() + 1)
		}
	} as unknown as VoidEvent

	callable.use = () => {
		/* no-op for void events */
	}
	return callable
}

// ---------------------------------------------------------------------------
// PayloadEvent<T> — event carrying a payload
// ---------------------------------------------------------------------------

export interface PayloadEvent<T> {
	/** Emit: writes payload (always fires). */
	(payload: T): void
	/** Read: returns latest payload (auto-tracks inside effects). */
	(): T | undefined
	/** Framework hook bridge. */
	use(): T | undefined
}

export function payloadEvent<T>(): PayloadEvent<T> {
	let seq = 0
	const inner = alienSignal<{v: T; id: number} | undefined>(undefined)

	// oxlint-disable-next-line no-unsafe-type-assertion -- callable matches PayloadEvent<T> interface but TS can't verify the overloaded call signature
	const callable = function payloadEventCallable(...args: [T] | []) {
		if (args.length) {
			// Emit — always fires because each box is a new object
			inner({v: args[0], id: ++seq})
		} else {
			// Read — returns unwrapped payload (auto-tracks)
			const box = inner()
			return box !== undefined ? box.v : undefined
		}
	} as unknown as PayloadEvent<T>

	// oxlint-disable-next-line no-unsafe-type-assertion -- getUseHookFactory returns () => unknown; cast to T | undefined is safe by PayloadEvent<T> contract
	callable.use = () => getUseHookFactory()(callable)() as T | undefined
	return callable
}

// ---------------------------------------------------------------------------
// watch() — skip-first-run helper for event subscriptions
// ---------------------------------------------------------------------------

/**
 * Creates an effect that skips its first execution.
 * Useful for subscribing to events without firing on initial creation.
 *
 * @param dep - dependency reader (called to establish tracking)
 * @param fn - callback invoked on subsequent runs
 * @returns dispose function
 */
export function watch(dep: () => unknown, fn: () => void): () => void {
	let initialized = false
	return alienEffect(() => {
		dep()
		if (!initialized) {
			initialized = true
			return
		}
		fn()
	})
}