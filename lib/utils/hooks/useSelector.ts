import {useState} from 'react'
import {SystemEvent} from '../../constants'
import type {Store} from '../classes/Store'
import {useStore} from '../providers/StoreProvider'
import {shallow} from '../functions/shallow'
import {useListener} from './useListener'

//TODO rename. by default return store
export const useSelector = <T, >(selector: (store: Store) => T, byStruct?: boolean) => {
	const store = useStore()
	const [value, setValue] = useState(() => selector(store))

	useListener(SystemEvent.STORE_UPDATED, store => {
		setValue(value => {
			const newValue = selector(store)
			if (byStruct && shallow(value, newValue)) return value
			return newValue
		})
	}, [])

	return value
}