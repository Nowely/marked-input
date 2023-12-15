import {DependencyList, useEffect} from 'react'
import {SystemEvent} from '../../constants'
import {Listener} from '../../types'
import {useStore} from '../providers/StoreProvider'

export function useListener(type: SystemEvent, listener: Listener, deps?: DependencyList): void
export function useListener<K extends keyof HTMLElementEventMap>(type: K, listener: Listener<HTMLElementEventMap[K]>, deps?: DependencyList): void
export function useListener(type: keyof HTMLElementEventMap | SystemEvent, listener: Listener, deps?: DependencyList) {
	if (typeof type === 'number') useSystemListener(type, listener, deps)
	else useContainerListener(type, listener, deps)
}

function useSystemListener(type: SystemEvent, listener: Listener, deps?: DependencyList) {
	const {bus} = useStore()
	useEffect(() => bus.listen(type, listener), deps)
}

function useContainerListener<K extends keyof HTMLElementEventMap>(type: K, listener: Listener<HTMLElementEventMap[K]>, deps?: DependencyList) {
	const store = useStore()
	useEffect(() => {
		store.containerRef.current?.addEventListener(type, listener)
		return () => store.containerRef.current?.removeEventListener(type, listener)
	}, deps)
}
