<script setup lang="ts">
import {inject, ref, computed, watch, onMounted} from 'vue'

import {useStore} from '../lib/hooks/useStore'
import {TOKEN_KEY} from '../lib/providers/tokenKey'
import {resolveSlot, resolveSlotProps} from '../lib/utils/resolveSlot'

const store = useStore()
const tokenRef = inject(TOKEN_KEY)!
const token = tokenRef.value
const elRef = ref<HTMLSpanElement | null>(null)

const slots = store.state.slots.use()
const slotProps = store.state.slotProps.use()
const spanTag = computed(() => resolveSlot('span', slots.value))
const spanProps = computed(() => resolveSlotProps('span', slotProps.value))

if (token.type !== 'text') {
	throw new Error('TextSpan component expects a TextToken')
}

onMounted(() => {
	if (elRef.value && elRef.value.textContent !== token.content) {
		elRef.value.textContent = token.content
	}
})

watch(
	() => token.content,
	content => {
		if (elRef.value && elRef.value.textContent !== content) {
			elRef.value.textContent = content
		}
	}
)
</script>

<template>
	<component :is="spanTag" :ref="(el: any) => (elRef = el)" v-bind="spanProps" />
</template>
