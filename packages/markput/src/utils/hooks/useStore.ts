import {useContext, useState} from 'react'
import type {Store} from '@markput/core'
import {SystemEvent, assertNonNullable, shallow} from '@markput/core'
import {StoreContext, StoreProps} from '../providers/StoreContext'
import {useListener} from './useListener'

export function useStore(): Store<StoreProps>
export function useStore<T>(selector: (store: Store<StoreProps>) => T, byStruct?: boolean): T
export function useStore<T>(selector?: (store: Store<StoreProps>) => T, byStruct?: boolean) {
	const store = useContext(StoreContext)
	assertNonNullable(store)

	const [value, setValue] = useState(() => selector?.(store))
	useListener(
		SystemEvent.STORE_UPDATED,
		() => {
			setValue(value => {
				const newValue = selector?.(store)
				if (byStruct && shallow(value, newValue)) return value
				return newValue
			})
		},
		[]
	)

	return selector ? value : store
}
