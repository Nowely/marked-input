import {ReactNode, useEffect, useState} from 'react'
import {InnerMarkedInputProps} from '../features/default'
import {Store} from '../utils/classes/Store'
import {StoreContext} from '../utils/providers/StoreContext'

interface StoreProviderProps {
	props: InnerMarkedInputProps
	children: ReactNode
}

export const StoreProvider = ({props, children}: StoreProviderProps) => {
	const [store] = useState(() => Store.create(props))

	useEffect(() => {
		store.props = props
	})

	return <StoreContext.Provider value={store} children={children} />
}
