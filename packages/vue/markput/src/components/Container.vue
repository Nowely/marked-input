<script lang="ts">
import type {CoreSlotProps, CoreSlots, StyleProperties, Token as CoreToken} from '@markput/core'
import {computed, defineComponent, h, type Ref} from 'vue'

import {useStore} from '../lib/hooks/useStore'
import {resolveSlot, resolveSlotProps} from '../lib/utils/resolveSlot'
import Token from './Token.vue'

export default defineComponent({
	setup() {
		const store = useStore()
		const tokens = store.state.tokens.use() as unknown as Ref<CoreToken[]>
		const slots = store.state.slots.use() as unknown as Ref<CoreSlots | undefined>
		const slotProps = store.state.slotProps.use() as unknown as Ref<CoreSlotProps | undefined>
		const className = store.state.className.use() as unknown as Ref<string | undefined>
		const style = store.state.style.use() as unknown as Ref<StyleProperties | undefined>
		const key = store.key

		const containerTag = computed(() => resolveSlot('container', slots.value))
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
