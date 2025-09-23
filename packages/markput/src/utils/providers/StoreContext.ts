import {createContext} from 'react'
import {Store} from '@markput/core'

export const StoreContext = createContext<Store | undefined>(undefined)
StoreContext.displayName = 'StoreContext'
