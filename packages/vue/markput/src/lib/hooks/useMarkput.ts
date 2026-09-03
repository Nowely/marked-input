import {effect, readSelected} from '@markput/core'
import type {SignalValues, Store, Selectable, ObjectSelector} from '@markput/core'
import {shallowRef, onUnmounted, type Ref} from 'vue'

import {useStore} from './useStore'

export function useMarkput<T>(selector: (store: Store) => Selectable<T>): Ref<T>
export function useMarkput<R extends ObjectSelector>(selector: (store: Store) => R): Ref<SignalValues<R>>
/**
 * A member of the store with nothing reactive about it — `s.rows`, `s.edit`, `s.tokens`. It is
 * handed back AS IT IS, identity and all, because a controller outlives every render of the
 * editor and there is nothing here for a snapshot to differ on. Ordered last, so an object
 * literal of signals still takes the unwrapping overload above it.
 *
 * THE CONSTRAINT NAMES THE THREE RATHER THAN SAYING `object`, because `object` is satisfied by
 * every non-primitive and would turn two compile errors into silent wrong answers: a CALLED signal
 * (`s.rows.selected()`) is an array, which `readSelected` hands straight back — the snapshot then
 * reads nothing reactive and is frozen at mount forever — and an INTERFACE-typed return gets no
 * implicit index signature, so it keeps its wrapped type while the runtime unwraps it key by key.
 * `Store[keyof Store]` does not work either: `KeyboardController` is structurally empty, so the
 * union swallows anything. The list grows when a fourth member needs selecting.
 */
export function useMarkput<T extends Store['rows'] | Store['edit'] | Store['tokens']>(
	selector: (store: Store) => T
): Ref<T>
export function useMarkput(selector: (store: Store) => object): Ref<unknown> {
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