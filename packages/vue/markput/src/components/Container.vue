<script setup lang="ts">
import {watch} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import Block from './Block.vue'
import Token from './Token.vue'

const result = useMarkput(s => ({
	layout: s.props.layout,
	tokens: s.state.tokens,
	key: s.key,
	state: s.state,
	event: s.event,
}))

const setContainerRef = (el: unknown) => {
	const resolved = el as {$el?: HTMLElement} | HTMLElement | null
	result.value.state.container(resolved?.$el ?? resolved)
}

const containerComponent = useMarkput(s => s.computed.containerComponent)
const containerProps = useMarkput(s => s.computed.containerProps)

watch(
	() => result.value.tokens,
	() => result.value.event.afterTokensRendered(),
	{flush: 'post', immediate: true}
)
</script>

<template>
	<component :is="containerComponent" :ref="setContainerRef" v-bind="containerProps">
		<template v-if="result.layout === 'block'">
			<Block
				v-for="(token, index) in result.tokens"
				:key="result.key.get(token)"
				:token="token"
				:block-index="index"
			/>
		</template>
		<template v-else>
			<Token v-for="token in result.tokens" :key="result.key.get(token)" :mark="token" />
		</template>
	</component>
</template>
