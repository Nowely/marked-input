import type {MarkOptions, RefAccessor} from '@markput/core'
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
	if (token.type !== 'mark') throw new Error('useMark must be called within a mark token context')

	const elRef = ref<T | null>(null)
	const refAccessor: RefAccessor<T> = {
		get current() {
			// oxlint-disable-next-line no-unsafe-return
			return elRef.value
		},
		set current(v: T | null) {
			elRef.value = v
		},
	}

	const mark = new MarkHandler<T>({ref: refAccessor, store, token})

	onMounted(() => {
		if (elRef.value && !options.controlled) {
			elRef.value.textContent = token.content
		}
	})

	const readOnly = store.state.readOnly.use()
	watch(readOnly, val => {
		mark.readOnly = val
	})

	return mark
}