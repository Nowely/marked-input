<script setup lang="ts">
import {onMounted, onUpdated} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import Block from './Block.vue'
import Token from './Token.vue'

const store = useStore()
const result = useMarkput(s => ({
	isBlock: s.props.layout.isBlock,
	tokens: s.tokens.renderTree,
	keyOf: s.tokens.keyOf,
}))

const setContainerRef = (el: unknown) => {
	const resolved = el as {$el?: HTMLElement} | HTMLElement | null
	const element = (resolved && '$el' in resolved ? resolved.$el : resolved) as HTMLDivElement | null
	store.host.container(element)
}

const containerComponent = useMarkput(s => s.slots.containerComponent)
const containerProps = useMarkput(s => s.slots.containerProps)

onMounted(() => store.host.rendered())
onUpdated(() => store.host.rendered())
</script>

<template>
	<component :is="containerComponent" :ref="setContainerRef" v-bind="containerProps">
		<template v-if="result.isBlock">
			<Block
				v-for="(token, index) in result.tokens"
				:key="result.keyOf(token)"
				:token="token"
				:block-index="index"
			/>
		</template>
		<template v-else>
			<Token v-for="(token, index) in result.tokens" :key="result.keyOf(token)" :token="token" :path="[index]" />
		</template>
	</component>
</template>
