import {effect, readSelected} from '@markput/core'
import type {SignalValues, Store, Selectable, ObjectSelector} from '@markput/core'
import {shallowRef, onUnmounted, type Ref} from 'vue'

import {useStore} from './useStore'

export function useMarkput<T>(selector: (store: Store) => Selectable<T>): Ref<T>
export function useMarkput<R extends ObjectSelector>(selector: (store: Store) => R): Ref<SignalValues<R>>
export function useMarkput(selector: (store: Store) => Selectable<unknown> | ObjectSelector): Ref<unknown> {
	const store = useStore()

	// Run selector once to capture the signal reference(s).
	// The selector is NOT re-run reactively — it is a stable signal picker.
	const target = selector(store)

	// shallowRef + effect bridges the two reactive systems.
	// The effect re-runs whenever tracked signals change, updating the ref.
	const r = shallowRef<unknown>(undefined)
	const stop = effect(() => {
		r.value = readSelected(target)
	})
	onUnmounted(stop)

	return r
}