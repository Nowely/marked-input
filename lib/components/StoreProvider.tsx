import {ReactNode, useEffect, useState} from 'react'
import {DefaultedProps} from '../types'
import {Store} from '../utils/classes/Store'
import {StoreContext} from '../utils/providers/StoreContext'

export const StoreProvider = ({props, children}: { props: DefaultedProps, children: ReactNode }) => {
	const [store] = useState(() => Store.create(props))

	useEffect(() => {
		store.props = props
	})

	return <StoreContext.Provider value={store} children={children}/>
}