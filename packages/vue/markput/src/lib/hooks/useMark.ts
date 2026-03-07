import type {MarkToken} from '@markput/core'
import {MarkHandler} from '@markput/core'
import {inject, ref, watch, onMounted} from 'vue'

import {TOKEN_KEY} from '../providers/tokenKey'
import {useStore} from './useStore'

export interface MarkOptions {
	controlled?: boolean
}

export const useMark = <T extends HTMLElement = HTMLElement>(options: MarkOptions = {}): MarkHandler<T> => {
	const store = useStore()
	const tokenRef = inject(TOKEN_KEY)

	if (!tokenRef) {
		throw new Error('Token not found. Make sure to use useMark inside a Token provider.')
	}

	const token = tokenRef.value
	if (token.type !== 'mark') {
		throw new Error('useMark can only be used with mark tokens')
	}

	const elRef = ref<T | null>(null)
	const refAccessor = {
		get current() {
			return elRef.value
		},
		set current(v: T | null) {
			elRef.value = v
		},
	}

	const mark = new MarkHandler<T>({ref: refAccessor as any, store, token: token as MarkToken})

	onMounted(() => {
		if (elRef.value && !options.controlled) {
			elRef.value.textContent = (token as MarkToken).content
		}
	})

	const readOnly = store.state.readOnly.use()
	watch(readOnly, val => {
		mark.readOnly = val
	})

	return mark
}