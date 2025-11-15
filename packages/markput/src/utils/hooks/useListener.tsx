import {DependencyList, useContext, useEffect} from 'react'
import {EventKey, Listener, assertNonNullable} from '@markput/core'
import {StoreContext} from '../providers/StoreContext'
import {useStore} from './useStore'

export function useListener<T>(key: EventKey<T>, listener: Listener<T>, deps?: DependencyList): void
export function useListener<K extends keyof HTMLElementEventMap>(
	key: K,
	listener: Listener<HTMLElementEventMap[K]>,
	deps?: DependencyList
): void
export function useListener(key: keyof HTMLElementEventMap | EventKey<any>, listener: Listener, deps?: DependencyList) {
	if (typeof key === 'string') {
		useContainerListener(key, listener, deps)
	} else {
		useSystemListener(key, listener, deps)
	}
}

function useSystemListener<K extends EventKey<T>, T>(key: K, listener: Listener<T>, deps?: DependencyList) {
	const store = useContext(StoreContext)
	assertNonNullable(store)

	useEffect(() => store.bus.on(key, listener), deps)
}

function useContainerListener<K extends keyof HTMLElementEventMap>(
	key: K,
	listener: Listener<HTMLElementEventMap[K]>,
	deps?: DependencyList
) {
	const store = useStore()
	useEffect(() => {
		store.refs.container?.addEventListener(key, listener)
		return () => store.refs.container?.removeEventListener(key, listener)
	}, deps)
}
