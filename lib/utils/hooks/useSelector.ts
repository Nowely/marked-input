import {useState} from 'react'
import {SystemEvent} from '../../constants'
import {State} from '../../types'
import {useStore} from '../providers/StoreProvider'
import {shallow} from '../functions/shallow'
import {useListener} from './useListener'

export const useSelector = <T, >(selector: (state: State) => T, byStruct?: boolean) => {
	const store = useStore()
	const [value, setValue] = useState(() => selector(store.state))

	useListener(SystemEvent.State, newState => {
		setValue(currentValue => {
			const newValue = selector(newState)
			if (byStruct && shallow(currentValue, newValue)) return currentValue
			return newValue
		})
	}, [])

	return value
}