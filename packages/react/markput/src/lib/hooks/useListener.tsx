import type {DependencyList} from 'react'
import {useContext, useEffect} from 'react'
import type {Listener, Signal, Emitter} from '@markput/core'
import {StoreContext} from '../providers/StoreContext'

type Subscribable<T> = Signal<T> | Emitter<T>

export function useListener<T>(subscribable: Subscribable<T>, listener: Listener<T>, deps?: DependencyList): void
export function useListener<K extends keyof HTMLElementEventMap>(
	key: K,
	listener: Listener<HTMLElementEventMap[K]>,
	deps?: DependencyList
): void
export function useListener(
	keyOrSubscribable: keyof HTMLElementEventMap | Subscribable<any>,
	listener: Listener,
	deps?: DependencyList
) {
	if (typeof keyOrSubscribable === 'string') {
		useContainerListener(keyOrSubscribable, listener, deps)
	} else {
		useSubscribableListener(keyOrSubscribable, listener, deps)
	}
}

function useSubscribableListener<T>(subscribable: Subscribable<T>, listener: Listener<T>, deps?: DependencyList) {
	useEffect(() => subscribable.on(listener), deps)
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
