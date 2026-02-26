import type {DependencyList} from 'react'
import {useContext, useEffect} from 'react'
import type {Listener, Reactive} from '@markput/core'
import {StoreContext} from '../providers/StoreContext'

export function useListener<T>(reactive: Reactive<T>, listener: Listener<T>, deps?: DependencyList): void
export function useListener<K extends keyof HTMLElementEventMap>(
	key: K,
	listener: Listener<HTMLElementEventMap[K]>,
	deps?: DependencyList
): void
export function useListener(
	keyOrReactive: keyof HTMLElementEventMap | Reactive<any>,
	listener: Listener,
	deps?: DependencyList
) {
	if (typeof keyOrReactive === 'string') {
		useContainerListener(keyOrReactive, listener, deps)
	} else {
		useReactiveListener(keyOrReactive, listener, deps)
	}
}

function useReactiveListener<T>(reactive: Reactive<T>, listener: Listener<T>, deps?: DependencyList) {
	useEffect(() => reactive.subscribe(listener), deps)
}

function useContainerListener<K extends keyof HTMLElementEventMap>(
	key: K,
	listener: Listener<HTMLElementEventMap[K]>,
	deps?: DependencyList
) {
	const store = useContext(StoreContext)
	useEffect(() => {
		store?.refs.container?.addEventListener(key, listener)
		return () => store?.refs.container?.removeEventListener(key, listener)
	}, deps)
}
