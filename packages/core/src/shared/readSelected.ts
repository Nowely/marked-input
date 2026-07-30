import {isReactive} from './signals'
import type {Signal, Computed} from './signals'

/** A single reactive signal or computed. */
export type Selectable<T> = Signal<T> | Computed<T>

/** An object whose values are either reactive (read via `()`) or plain. */
export type ObjectSelector = Record<string, Selectable<unknown> | unknown>

/**
 * Read the current value from a selector target — either a single reactive
 * signal/computed or an object whose values may be reactive.
 *
 * This is the framework-independent snapshot logic shared by both React and
 * Vue useMarkput bridges.
 */
export function readSelected(target: Selectable<unknown> | ObjectSelector): unknown {
	if (typeof target === 'function') {
		return target()
	}
	const out: Record<string, unknown> = {}
	for (const k in target) {
		const val = target[k]
		out[k] = isReactive(val) ? val() : val
	}
	return out
}