import {ReactNode, useEffect, useState} from 'react'
import {Store} from '@markput/core'
import {StoreContext, StoreProps} from '../utils/providers/StoreContext'

interface StoreProviderProps {
	props: StoreProps
	children: ReactNode
}

export const StoreProvider = ({props, children}: StoreProviderProps) => {
	const [store] = useState(() => Store.create(props))

	useEffect(() => {
		store.props = props
	})

	return <StoreContext.Provider value={store} children={children} />
}
