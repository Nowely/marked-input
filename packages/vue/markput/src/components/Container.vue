<script lang="ts">
import type {StyleProperties, Token as CoreToken} from '@markput/core'
import {resolveSlot, resolveSlotProps} from '@markput/core'
import type {Component} from 'vue'
import {computed, defineComponent, h} from 'vue'

import {useStore} from '../lib/hooks/useStore'
import Token from './Token.vue'

export default defineComponent({
	setup() {
		const store = useStore()
		const tokens = store.state.tokens.use()
		const slots = store.state.slots.use()
		const slotProps = store.state.slotProps.use()
		const className = store.state.className.use()
		const style = store.state.style.use()
		const key = store.key

		const containerTag = computed(() => resolveSlot<string | Component>('container', slots.value))
		const containerProps = computed(() => resolveSlotProps('container', slotProps.value))

		return () =>
			h(
				containerTag.value,
				{
					ref: (el: any) => {
						store.refs.container = el?.$el ?? el
					},
					...containerProps.value,
					class: className.value,
					style: style.value,
				},
				tokens.value.map(token => h(Token, {key: key.get(token), mark: token}))
			)
	},
})
</script>
