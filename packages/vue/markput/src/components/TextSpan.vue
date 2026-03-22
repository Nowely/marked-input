<script setup lang="ts">
import {inject, ref, computed, watch, onMounted} from 'vue'

import {useSlot} from '../lib/hooks/useSlot'
import {TOKEN_KEY} from '../lib/providers/tokenKey'

const tokenRef = inject(TOKEN_KEY)!
const token = tokenRef.value
const elRef = ref<HTMLSpanElement | null>(null)

const resolved = computed(() => useSlot('span'))
const spanTag = computed(() => resolved.value[0])
const spanProps = computed(() => resolved.value[1])

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
