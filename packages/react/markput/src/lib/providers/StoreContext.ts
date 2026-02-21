import {createContext} from 'react'
import type {Store} from '@markput/core'
import type {MarkedInputProps} from '../../components/MarkedInput'

export const StoreContext = createContext<Store<MarkedInputProps> | undefined>(undefined)
StoreContext.displayName = 'StoreContext'
