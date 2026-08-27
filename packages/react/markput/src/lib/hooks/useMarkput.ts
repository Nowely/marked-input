import {computed, watch, readSelected} from '@markput/core'
import type {SignalValues, Store, Selectable, ObjectSelector} from '@markput/core'
import {useSyncExternalStore, useContext, useRef} from 'react'

import {StoreContext} from '../providers/StoreContext'

type StableRef = {
	subscribe: (cb: () => void) => () => void
	getSnapshot: () => unknown
}

export function useMarkput<T>(selector: (store: Store) => Selectable<T>): T
export function useMarkput<R extends ObjectSelector>(selector: (store: Store) => R): SignalValues<R>
/**
 * A member of the store with nothing reactive about it — `s.rows`, `s.edit`, `s.tokens`. It is
 * handed back AS IT IS, identity and all, because a controller outlives every render of the
 * editor and there is nothing here for a snapshot to differ on. Ordered last, so an object
 * literal of signals still takes the unwrapping overload above it.
 */
export function useMarkput<T extends object>(selector: (store: Store) => T): T
export function useMarkput(selector: (store: Store) => object): unknown {
	const store = useContext(StoreContext)
	if (store === undefined) throw new Error('Store not found. Make sure to wrap component in StoreContext.')

	// Holds stable computed + subscribe + snapshot — created once, never recreated.
	const stableRef = useRef<StableRef | null>(null)

	if (stableRef.current === null) {
		const target = selector(store)

		const derived = computed((): unknown => readSelected(target))

		stableRef.current = {
			subscribe: cb => watch(derived, cb),
			getSnapshot: () => derived(),
		}
	}

	const {subscribe, getSnapshot} = stableRef.current
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}