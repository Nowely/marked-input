import type {Store} from '@markput/core'
import {onMounted, onUnmounted, watch} from 'vue'

import type {Option} from '../../types'

export function useCoreFeatures(store: Store) {
	onMounted(() => {
		store.lifecycle.enable<Option>({
			getTrigger: option => option.overlay?.trigger,
		})
	})

	onUnmounted(() => {
		store.lifecycle.disable()
	})

	const value = store.state.value.use()
	const Mark = store.state.Mark.use()
	const coreOptions = store.state.options.use()

	watch(
		[value, coreOptions, Mark],
		() => {
			store.lifecycle.syncParser()
		},
		{flush: 'post', immediate: true}
	)

	const tokens = store.state.tokens.use()
	watch(
		tokens,
		() => {
			store.lifecycle.recoverFocus()
		},
		{flush: 'post'}
	)
}