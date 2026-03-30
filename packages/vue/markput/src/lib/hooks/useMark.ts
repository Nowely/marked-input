import type {MarkOptions, MarkToken, RefAccessor} from '@markput/core'
import {MarkHandler} from '@markput/core'
import {inject, ref, watch, onMounted} from 'vue'

import {TOKEN_KEY} from '../providers/tokenKey'
import {useStore} from './useStore'

export const useMark = <T extends HTMLElement = HTMLElement>(options: MarkOptions = {}): MarkHandler<T> => {
	const store = useStore()
	const tokenRef = inject(TOKEN_KEY)

	if (!tokenRef) {
		throw new Error('Token not found. Make sure to use useMark inside a Token provider.')
	}

	const token = tokenRef.value

	const elRef = ref<T | null>(null)
	const refAccessor = {
		get current() {
			// oxlint-disable-next-line no-unsafe-return
			return elRef.value
		},
		set current(v: T | null) {
			elRef.value = v
		},
	}

	const mark = new MarkHandler<T>({ref: refAccessor as RefAccessor<T>, store, token: token as MarkToken})

	onMounted(() => {
		if (elRef.value && !options.controlled) {
			// oxlint-disable-next-line no-unsafe-member-access
			elRef.value.textContent = (token as MarkToken).content
		}
	})

	const readOnly = store.state.readOnly.use()
	watch(readOnly, val => {
		mark.readOnly = val
	})

	return mark
}