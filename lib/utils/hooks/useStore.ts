import {useContext, useState} from 'react'
import {SystemEvent} from '../../constants'
import {assertNonNullable} from '../checkers/assertNonNullable'
import type {Store} from '../classes/Store'
import {shallow} from '../functions/shallow'
import {StoreContext} from '../providers/StoreContext'
import {useListener} from './useListener'

export function useStore(): Store
export function useStore<T>(selector: (store: Store) => T, byStruct?: boolean): T
export function useStore<T, >(selector?: (store: Store) => T, byStruct?: boolean) {
	const store = useContext(StoreContext)
	assertNonNullable(store)

	const [value, setValue] = useState(() => selector?.(store))
	useListener(SystemEvent.STORE_UPDATED, () => {
		setValue(value => {
			const newValue = selector?.(store)
			if (byStruct && shallow(value, newValue)) return value
			return newValue
		})
	}, [])


	return selector ? value : store
}