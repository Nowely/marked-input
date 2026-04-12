<script setup lang="ts">
import type {CSSProperties} from '@markput/core'
import {computed, watch} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import Block from './Block.vue'
import Token from './Token.vue'

const store = useStore()

const drag = useMarkput(s => s.props.drag)
const readOnly = useMarkput(s => s.props.readOnly)
const tokens = useMarkput(s => s.state.tokens)
const className = useMarkput(s => s.computed.containerClass)
const style = useMarkput(s => s.computed.containerStyle)
const containerSlot = useMarkput(s => s.computed.container)

watch(tokens, () => store.event.afterTokensRendered(), {flush: 'post', immediate: true})

const key = store.key

const containerStyle = computed(() => {
	const s = style.value as CSSProperties | undefined
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
