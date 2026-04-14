<script setup lang="ts">
import {watch} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import Block from './Block.vue'
import Token from './Token.vue'

const result = useMarkput(s => ({
	drag: s.props.drag,
	tokens: s.state.tokens,
	key: s.key,
	refs: s.refs,
	event: s.event,
}))

const containerComponent = useMarkput(s => s.computed.containerComponent)
const containerProps = useMarkput(s => s.computed.containerProps)

watch(
	() => result.value.tokens,
	() => result.value.event.afterTokensRendered(),
	{flush: 'post', immediate: true}
)
</script>

<template>
	<component
		:is="containerComponent"
		:ref="
			(el: any) => {
				result.refs.container = el?.$el ?? el
			}
		"
		v-bind="containerProps"
	>
		<template v-if="result.drag">
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
