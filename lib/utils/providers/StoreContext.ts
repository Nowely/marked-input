import {createContext} from 'react'
import {Store} from '../classes/Store'

export const StoreContext = createContext<Store | undefined>(undefined)
StoreContext.displayName = 'StoreContext'
