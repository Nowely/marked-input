import type {Store} from '@markput/core'
import {createContext} from 'react'

export const StoreContext = createContext<Store | undefined>(undefined)
StoreContext.displayName = 'StoreContext'