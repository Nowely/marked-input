<script setup lang="ts">
import {inject, onMounted, ref, watch} from 'vue'

import {TOKEN_KEY} from '../lib/providers/tokenKey'
import type {MarkProps} from '../types'

defineProps<MarkProps>()

const tokenRef = inject(TOKEN_KEY)!
const token = tokenRef.value

if (token.type !== 'text') {
	throw new Error('Span expects a text token')
}

const elRef = ref<HTMLSpanElement | null>(null)

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
	<span :ref="(el: any) => (elRef = el)" />
</template>
