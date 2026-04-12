<script setup lang="ts">
import {watch} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import Block from './Block.vue'
import Token from './Token.vue'

const store = useStore()

const drag = useMarkput(s => s.props.drag)
const tokens = useMarkput(s => s.state.tokens)
const containerComponent = useMarkput(s => s.computed.containerComponent)
const containerProps = useMarkput(s => s.computed.containerProps)

watch(tokens, () => store.event.afterTokensRendered(), {flush: 'post', immediate: true})

const key = store.key
</script>

<template>
	<component
		:is="containerComponent"
		:ref="
			(el: any) => {
				store.refs.container = el?.$el ?? el
			}
		"
		v-bind="containerProps"
	>
		<template v-if="drag">
			<Block v-for="(token, index) in tokens" :key="key.get(token)" :token="token" :block-index="index" />
		</template>
		<template v-else>
			<Token v-for="token in tokens" :key="key.get(token)" :mark="token" />
		</template>
	</component>
</template>
