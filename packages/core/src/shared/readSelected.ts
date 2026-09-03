import {isReactive} from './signals'
import type {Signal, Computed} from './signals'

/** A single reactive signal or computed. */
export type Selectable<T> = Signal<T> | Computed<T>

/** An object whose values are either reactive (read via `()`) or plain. */
export type ObjectSelector = Record<string, Selectable<unknown> | unknown>

/**
 * Read the current value from a selector target — a single reactive signal/computed, an object
 * whose values may be reactive, or a value with nothing reactive about it at all.
 *
 * This is the framework-independent snapshot logic shared by both React and
 * Vue useMarkput bridges.
 *
 * THE THIRD ARM IS WHAT MAKES `useMarkput(s => s.rows)` MEAN SOMETHING. A controller is a class
 * instance: it holds no reactive value of its own and lives as long as the editor does, so the
 * only correct snapshot of it is the instance itself. Copying it key by key is not a lesser
 * answer, it is a wrong one — a prototype's methods are not enumerable, so the copy would arrive
 * with every verb missing. And an unchanging identity is exactly what React's
 * `useSyncExternalStore` wants back.
 *
 * A PLAIN object is the one shape the unwrapping arm is for, which is why the test is the
 * prototype rather than `typeof`.
 */
export function readSelected(target: object): unknown {
	if (isCallable(target)) return target()
	if (!isPlainObject(target)) return target
	const out: Record<string, unknown> = {}
	for (const k in target) {
		const val = target[k]
		out[k] = isReactive(val) ? val() : val
	}
	return out
}

/** Wider than {@link isReactive} on purpose: a bare closure is a derivation both adapters pass. */
function isCallable(value: object): value is () => unknown {
	return typeof value === 'function'
}

/**
 * `null` and `undefined` are tested FIRST because `Object.getPrototypeOf` throws on them, and this
 * runs inside the reactive primitive each adapter's `useMarkput` drives — React's `getSnapshot`,
 * Vue's `effect`. A throw there lands in the framework's own frame and takes the render root down
 * with it, which is the one thing `reportBadProp` exists to say the library never does at a
 * consumer boundary. The published parameter is `object`, so only an untyped selector gets here.
 */
function isPlainObject(value: object | null | undefined): value is Record<string, unknown> {
	if (value === null || value === undefined) return false
	const prototype: unknown = Object.getPrototypeOf(value)
	return prototype === Object.prototype || prototype === null
}