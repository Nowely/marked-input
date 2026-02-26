import {useContext, useEffect, useState} from 'react'
import type {Store} from '@markput/core'
import {assertNonNullable, shallow} from '@markput/core'
import {StoreContext} from '../providers/StoreContext'
import type {MarkedInputProps} from '../../components/MarkedInput'

export function useStore(): Store<MarkedInputProps>
export function useStore<T>(selector: (store: Store<MarkedInputProps>) => T, byStruct?: boolean): T
export function useStore<T>(selector?: (store: Store<MarkedInputProps>) => T, byStruct?: boolean) {
	const store = useContext(StoreContext)
	assertNonNullable(store)

	const [value, setValue] = useState(() => selector?.(store))

	useEffect(() => {
		return store.subscribe(() => {
			setValue(prevValue => {
				const newValue = selector?.(store)
				if (byStruct && shallow(prevValue, newValue)) return prevValue
				return newValue
			})
		})
	}, [])

	return selector ? value : store
}
