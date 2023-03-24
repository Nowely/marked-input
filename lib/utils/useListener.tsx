import {DependencyList, useEffect} from 'react'
import {Listener, Type} from '../types'
import {useStore} from './index'
import {Store} from './Store'

export function useListener(type: Type, listener: Listener, deps?: DependencyList, store?: Store) {
	const {bus} = store ?? useStore()
	useEffect(() => bus.listen(type, listener), deps)
}

export function useContainerListener<K extends keyof HTMLElementEventMap>(type: K, listener: Listener, deps?: DependencyList, store?: Store) {
	const store1 = store ?? useStore()
	useEffect(() => {
		store1.containerRef.current?.addEventListener(type, listener)
		return () => store1.containerRef.current?.removeEventListener(type, listener)
	}, deps)
}
