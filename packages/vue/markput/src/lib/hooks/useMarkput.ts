import {effect as alienEffect} from '@markput/core'
import type {Signal, Computed, SignalValues, Store} from '@markput/core'
import {shallowRef, onUnmounted, type Ref} from 'vue'

import {useStore} from './useStore'

type Selectable<T> = Signal<T> | Computed<T>
type ObjectSelector = Record<string, Selectable<unknown>>

export function useMarkput<T>(selector: (store: Store) => Selectable<T>): Ref<T>
export function useMarkput<R extends ObjectSelector>(selector: (store: Store) => R): Ref<SignalValues<R>>
export function useMarkput(selector: (store: Store) => Selectable<unknown> | ObjectSelector): Ref<unknown> {
	const store = useStore()

	// Run selector once to capture the signal reference(s).
	// The selector is NOT re-run reactively — it is a stable signal picker.
	const target = selector(store)

	const getValue = (): unknown => {
		if (typeof target === 'function') {
			return target()
		}
		const out: Record<string, unknown> = {}
		for (const key in target) {
			out[key] = target[key]()
		}
		return out
	}

	// shallowRef + alien-signals effect bridges the two reactive systems.
	// The effect re-runs whenever tracked signals change, updating the ref.
	const r = shallowRef(getValue())
	const stop = alienEffect(() => {
		r.value = getValue()
	})
	onUnmounted(stop)

	return r
}