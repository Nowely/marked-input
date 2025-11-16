import {ReactNode, useEffect, useState} from 'react'
import {Store} from '@markput/core'
import {parseProps} from '../features/default'
import {MarkedInputProps} from './MarkedInput'
import {StoreContext} from '../utils/providers/StoreContext'

interface StoreProviderProps {
	props: MarkedInputProps
	children: ReactNode
}

export const StoreProvider = ({props, children}: StoreProviderProps) => {
	const storeProps = parseProps(props)
	const [store] = useState(() => Store.create(storeProps))

	useEffect(() => {
		store.props = storeProps
	})

	return <StoreContext.Provider value={store} children={children} />
}
