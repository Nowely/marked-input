import type {Store} from '@markput/core'
import {inject} from 'vue'

import {STORE_KEY} from '../providers/storeKey'

export function useStore(): Store {
	const store = inject(STORE_KEY)
	if (!store) {
		throw new Error('Store not found. Make sure to use this composable inside a MarkedInput component.')
	}
	return store
}