import type {Store} from '@markput/core'
import {assertNonNullable} from '@markput/core'
import {useContext} from 'react'

import {StoreContext} from '../providers/StoreContext'

export function useStore(): Store {
	const store = useContext(StoreContext)
	assertNonNullable(store)
	return store
}