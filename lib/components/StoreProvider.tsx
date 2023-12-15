import {ReactNode, useEffect, useState} from 'react'
import {Store} from '../utils/classes/Store'
import {StoreContext} from '../utils/providers/StoreProvider'
import {MarkedInputProps} from './MarkedInput'

export const StoreProvider = ({props, children}: { props: MarkedInputProps, children: ReactNode }) => {
	const [store] = useState(() => new Store(props))

	useEffect(() => store.setState(props))

	return <StoreContext.Provider value={store} children={children}/>
}