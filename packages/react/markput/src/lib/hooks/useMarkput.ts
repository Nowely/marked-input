import {computed, watch} from '@markput/core'
import type {Signal, Computed, SignalValues, Store} from '@markput/core'
import {useSyncExternalStore, useRef} from 'react'

import {useStore} from '../providers/StoreContext'

type Selectable<T> = Signal<T> | Computed<T>
type ObjectSelector = Record<string, Selectable<unknown>>

type StableRef = {
	derived: Computed<unknown>
	subscribe: (cb: () => void) => () => void
	getSnapshot: () => unknown
}

export function useMarkput<T>(selector: (store: Store) => Selectable<T>): T
export function useMarkput<R extends ObjectSelector>(selector: (store: Store) => R): SignalValues<R>
export function useMarkput(selector: (store: Store) => Selectable<unknown> | ObjectSelector): unknown {
	const store = useStore()

	// Holds stable computed + subscribe + snapshot — created once, never recreated.
	const stableRef = useRef<StableRef | null>(null)

	if (stableRef.current === null) {
		const target = selector(store)

		const derived = computed((): unknown => {
			if (typeof target === 'function') {
				// Single Signal<T> or Computed<T>
				return target()
			}
			// Object of signals — unwrap each entry
			const out: Record<string, unknown> = {}
			for (const key in target) {
				out[key] = target[key]()
			}
			return out
		})

		stableRef.current = {
			derived,
			subscribe: cb => watch(derived, cb),
			getSnapshot: () => derived(),
		}
	}

	const {subscribe, getSnapshot} = stableRef.current
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}