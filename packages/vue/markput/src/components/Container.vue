<script setup lang="ts">
import {watch} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import Block from './Block.vue'
import Token from './Token.vue'

const store = useStore()
const result = useMarkput(s => ({
	isBlock: s.slots.isBlock,
	tokens: s.parsing.tokens,
	key: s.key,
}))
const structuralKey = useMarkput(s => s.dom.structuralKey)

const setContainerRef = (el: unknown) => {
	const resolved = el as {$el?: HTMLElement} | HTMLElement | null
	const element = (resolved && '$el' in resolved ? resolved.$el : resolved) as HTMLDivElement | null
	store.dom.container(element)
}

const containerComponent = useMarkput(s => s.slots.containerComponent)
const containerProps = useMarkput(s => s.slots.containerProps)

watch(
	() => structuralKey.value,
	() => {
		store.lifecycle.rendered()
	},
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
			<Token v-for="token in result.tokens" :key="result.key.get(token)" :token="token" />
		</template>
	</component>
</template>
