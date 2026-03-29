import type {Signal} from '@markput/core'
import {useSyncExternalStore} from 'react'

export const createUseHook = <T>(signal: Signal<T>) => {
	const subscribe = (callback: () => void) => signal.on(callback)
	const getSnapshot = () => signal.get()
	return () => useSyncExternalStore(subscribe, getSnapshot)
}