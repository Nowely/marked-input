import type {Store} from '@markput/core'
import {onMounted, onUnmounted, watch, type Ref} from 'vue'

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

	const value = store.state.value.use() as unknown as Ref<string | undefined>
	const Mark = store.state.Mark.use() as unknown as Ref<unknown>
	const coreOptions = store.state.options.use() as unknown as Ref<Option[] | undefined>

	watch(
		[value, coreOptions, Mark],
		() => {
			const options = Mark.value ? coreOptions.value : undefined
			store.lifecycle.syncParser(value.value, options)
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