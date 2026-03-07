import type {Store} from '@markput/core'
import {createContext, useContext} from 'react'

export const StoreContext = createContext<Store | undefined>(undefined)
StoreContext.displayName = 'StoreContext'

export function useStore(): Store {
	const store = useContext(StoreContext)
	if (store === undefined) {
		throw new Error('Store not found. Make sure to wrap component in StoreContext.')
	}
	return store
}