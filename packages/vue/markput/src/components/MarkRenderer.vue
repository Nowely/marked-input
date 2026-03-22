<script setup lang="ts">
import type {MarkToken} from '@markput/core'
import {inject, computed, type Ref} from 'vue'

import {useSlot} from '../lib/hooks/useSlot'
import {useStore} from '../lib/hooks/useStore'
import {TOKEN_KEY} from '../lib/providers/tokenKey'
import type {MarkProps, Option} from '../types'
// eslint-disable-next-line import/no-cycle
import Token from './Token.vue'

const store = useStore()
const tokenRef = inject(TOKEN_KEY)!
const node = tokenRef.value as MarkToken
const optionsRef = store.state.options.use() as Ref<Option[] | undefined>
const key = store.key

const markPropsData: MarkProps = {
	value: node.value,
	meta: node.meta,
}

const resolved = computed(() => {
	const option = optionsRef.value?.[node.descriptor.index]
	return useSlot('mark', option, markPropsData)
})
</script>

<template>
	<component v-if="node.children.length > 0" :is="resolved[0]" v-bind="resolved[1]">
		<Token v-for="child in node.children" :key="key.get(child)" :mark="child" :is-nested="true" />
	</component>
	<component v-else :is="resolved[0]" v-bind="resolved[1]" />
</template>
