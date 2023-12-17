import {DependencyList, useEffect} from 'react'
import {EventKey, Listener} from '../../types'
import {useStore} from '../providers/StoreProvider'

export function useListener<T>(key: EventKey<T>, listener: Listener<T>, deps?: DependencyList): void
export function useListener<K extends keyof HTMLElementEventMap>(key: K, listener: Listener<HTMLElementEventMap[K]>, deps?: DependencyList): void
export function useListener(key: keyof HTMLElementEventMap | EventKey<any>, listener: Listener, deps?: DependencyList) {
	if (typeof key === 'string') {
		useContainerListener(key, listener, deps)
	} else {
		useSystemListener(key, listener, deps)
	}
}

function useSystemListener<K extends EventKey<T>, T>(key: K, listener: Listener<T>, deps?: DependencyList) {
	const {bus} = useStore()
	useEffect(() => bus.on(key, listener), deps)
}

function useContainerListener<K extends keyof HTMLElementEventMap>(key: K, listener: Listener<HTMLElementEventMap[K]>, deps?: DependencyList) {
	const store = useStore()
	useEffect(() => {
		store.containerRef.current?.addEventListener(key, listener)
		return () => store.containerRef.current?.removeEventListener(key, listener)
	}, deps)
}
