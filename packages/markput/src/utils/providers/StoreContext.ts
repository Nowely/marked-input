import {createContext} from 'react'
import {Store} from '@markput/core'
import {MarkedInputProps} from '../../components/MarkedInput'

export const StoreContext = createContext<Store<MarkedInputProps> | undefined>(undefined)
StoreContext.displayName = 'StoreContext'
