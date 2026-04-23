<script setup lang="ts">
import {watch} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import Block from './Block.vue'
import Token from './Token.vue'

const result = useMarkput(s => ({
	isBlock: s.feature.slots.computed.isBlock,
	tokens: s.feature.parsing.state.tokens,
	key: s.key,
	slotsState: s.feature.slots.state,
	lifecycleEmit: s.feature.lifecycle,
}))

const setContainerRef = (el: unknown) => {
	const resolved = el as {$el?: HTMLElement} | HTMLElement | null
	result.value.slotsState.container(
		(resolved && '$el' in resolved ? resolved.$el : resolved) as HTMLDivElement | null
	)
}

const containerComponent = useMarkput(s => s.feature.slots.computed.containerComponent)
const containerProps = useMarkput(s => s.feature.slots.computed.containerProps)

watch(
	() => result.value.tokens,
	() => result.value.lifecycleEmit.rendered(),
	{flush: 'post', immediate: true}
)
</script>

<template>
	<component :is="containerComponent" :ref="setContainerRef" v-bind="containerProps">
		<template v-if="result.isBlock">
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
