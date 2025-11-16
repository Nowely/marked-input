import {createContext} from 'react'
import {Store, CoreMarkputProps} from '@markput/core'
import {MarkedInputProps} from '../../components/MarkedInput'

/**
 * Store props type: MarkedInputProps with all required fields
 * Used internally after parseProps transforms optional props to required
 */
export interface StoreProps extends MarkedInputProps {
	trigger: CoreMarkputProps['trigger']
	options: CoreMarkputProps['options']
}

export const StoreContext = createContext<Store<StoreProps> | undefined>(undefined)
StoreContext.displayName = 'StoreContext'
