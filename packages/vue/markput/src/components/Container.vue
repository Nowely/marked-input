<script setup lang="ts">
import type {CSSProperties} from '@markput/core'
import {computed, watch, type Ref} from 'vue'

import {useStore} from '../lib/hooks/useStore'
import Block from './Block.vue'
import Token from './Token.vue'

const store = useStore()
const drag = store.state.drag.use()
const readOnly = store.state.readOnly.use()
const tokens = store.state.tokens.use()
watch(tokens, () => store.event.afterTokensRendered(), {flush: 'post', immediate: true})

const className = store.computed.containerClass.use()
const style = store.computed.containerStyle.use() as unknown as Ref<CSSProperties | undefined>
const key = store.key

const containerSlot = store.computed.container.use()
const containerStyle = computed(() => {
	const s = style.value
	if (drag.value && !readOnly.value) {
		return s ? {paddingLeft: 24, ...s} : {paddingLeft: 24}
	}
	return s
})
</script>

<template>
	<component
		:is="containerSlot[0]"
		:ref="
			(el: any) => {
				store.refs.container = el?.$el ?? el
			}
		"
		v-bind="containerSlot[1]"
		:class="className"
		:style="containerStyle"
	>
		<template v-if="drag">
			<Block v-for="(token, index) in tokens" :key="key.get(token)" :token="token" :block-index="index" />
		</template>
		<template v-else>
			<Token v-for="token in tokens" :key="key.get(token)" :mark="token" />
		</template>
	</component>
</template>
