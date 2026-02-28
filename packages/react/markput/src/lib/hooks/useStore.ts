import {useContext} from 'react'
import {StoreContext} from '../providers/StoreContext'
import type {Store} from '@markput/core'
import {assertNonNullable} from '@markput/core'

export function useStore(): Store {
	const store = useContext(StoreContext)
	assertNonNullable(store)
	return store
}
