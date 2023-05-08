import {useState} from 'react'
import {SystemEvent} from '../constants'
import {State} from '../types'
import {useStore} from './index'
import {shallow} from './shallow'
import {useListener} from './useListener'

export const useSelector = <T, >(func: (state: State) => T, byStruct?: boolean) => {
	const store = useStore()
	const [value, setValue] = useState(() => func(store.state))

	useListener(SystemEvent.State, newState => {
		setValue(currentValue => {
			const newValue = func(newState)
			if (byStruct && shallow(currentValue, newValue)) return currentValue
			return newValue
		})
	}, [])

	return value
}