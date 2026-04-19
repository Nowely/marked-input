import {computed, watch, isReactive} from '@markput/core'
import type {Signal, Computed, SignalValues, Store} from '@markput/core'
import {useSyncExternalStore, useContext, useRef} from 'react'

import {StoreContext} from '../providers/StoreContext'

type Selectable<T> = Signal<T> | Computed<T>
type ObjectSelector = Record<string, Selectable<unknown> | unknown>

type StableRef = {
	derived: Computed<unknown>
	subscribe: (cb: () => void) => () => void
	getSnapshot: () => unknown
}

export function useMarkput<T>(selector: (store: Store) => Selectable<T>): T
export function useMarkput<R extends ObjectSelector>(selector: (store: Store) => R): SignalValues<R>
export function useMarkput(selector: (store: Store) => Selectable<unknown> | ObjectSelector): unknown {
	const store = useContext(StoreContext)
	if (store === undefined) throw new Error('Store not found. Make sure to wrap component in StoreContext.')

	// Holds stable computed + subscribe + snapshot — created once, never recreated.
	const stableRef = useRef<StableRef | null>(null)

	if (stableRef.current === null) {
		const target = selector(store)

		const derived = computed((): unknown => {
			if (typeof target === 'function') {
				return target()
			}
			const out: Record<string, unknown> = {}
			for (const k in target) {
				const val = target[k]
				out[k] = isReactive(val) ? (val as () => unknown)() : val
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