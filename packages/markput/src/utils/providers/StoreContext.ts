import {createContext} from 'react'
import {Store} from '@markput/core/src/utils/classes/Store'

export const StoreContext = createContext<Store | undefined>(undefined)
StoreContext.displayName = 'StoreContext'
