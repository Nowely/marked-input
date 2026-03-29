import type {CoreOption, Store, Token} from '@markput/core'
import type {ComponentType, ElementType} from 'react'
import {createContext, useContext} from 'react'

import type {MarkProps, OverlayProps} from '../../types'

declare module '@markput/core' {
	interface MarkSlot {
		use(token: Token): readonly [ComponentType<any>, MarkProps]
	}
	interface OverlaySlot {
		use(option?: CoreOption, defaultComponent?: ComponentType<any>): readonly [ComponentType<any>, OverlayProps]
	}
	interface Slot {
		use(): readonly [ElementType, Record<string, unknown> | undefined]
	}
}

export const StoreContext = createContext<Store | undefined>(undefined)
StoreContext.displayName = 'StoreContext'

export function useStore(): Store {
	const store = useContext(StoreContext)
	if (store === undefined) {
		throw new Error('Store not found. Make sure to wrap component in StoreContext.')
	}
	return store
}