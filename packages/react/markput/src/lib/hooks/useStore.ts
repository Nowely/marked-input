import {useContext} from 'react'
import {StoreContext} from '../providers/StoreContext'
import type {Store} from '@markput/core'
import {assertNonNullable} from '@markput/core'
import type {MarkedInputProps} from '../../components/MarkedInput'

export function useStore(): Store<MarkedInputProps> {
	const store = useContext(StoreContext)
	assertNonNullable(store)
	return store
}
