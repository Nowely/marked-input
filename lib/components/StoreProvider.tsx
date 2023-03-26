import {ReactNode, useEffect, useState} from 'react'
import {extractOptions, StoreContext} from '../utils'
import {Store} from '../utils/Store'
import {MarkedInputProps} from './MarkedInput'

export const StoreProvider = ({props, children}: { props: MarkedInputProps, children: ReactNode }) => {
	const [store] = useState(Store.create(props))
	useStateUpdating(props, store)
	return (
		<StoreContext.Provider value={store}>
			{children}
		</StoreContext.Provider>
	)
}


function useStateUpdating(props: MarkedInputProps, store: Store) {
	const {options, ...other} = props
	useEffect(() => store.setState({options: extractOptions(options)}), [options])
	useEffect(() => store.setState({...other}))
}