<script setup lang="ts">
import {computed} from 'vue'
import type {Ref} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import {unwrapEl} from '../lib/unwrapEl'
import Block from './Block.vue'
import Token from './Token.vue'

const store = useStore()
const result = useMarkput(s => ({
	isBlock: s.props.layout.isBlock,
	nodes: s.tokens.nodes,
}))

const containerComponent = useMarkput(s => s.slots.containerComponent)
const containerProps = useMarkput(s => s.slots.containerProps)

// Compose the host ref with a user-provided slotProps.container ref: the model
// publishes tokens only once the container mounts, so letting a user ref shadow
// the host ref would leave the editor permanently empty. We strip the user's
// `ref` from the spread so it isn't forwarded onto the element (Vue 3 does NOT
// treat `ref` inside a v-bind object as a template ref, but we still exclude it
// to avoid passing a function/Ref as a DOM attribute); the host's
// `:ref="setContainerRef"` is then the sole template ref and must fire or the
// model never publishes tokens.
type UserRef = ((el: HTMLElement | null) => void) | Ref<HTMLElement | null>

const containerSlot = computed(() => containerProps.value as {ref?: UserRef} & Record<string, unknown>)
const userRef = computed<UserRef | undefined>(() => containerSlot.value.ref)
const boundProps = computed(() => {
	const {ref: _ref, ...rest} = containerSlot.value
	return rest
})

const setContainerRef = (el: unknown) => {
	const element = unwrapEl(el)
	store.host.container(element)

	const user = userRef.value
	if (typeof user === 'function') user(element)
	else if (user) user.value = element
}
</script>

<template>
	<component :is="containerComponent" :ref="setContainerRef" v-bind="boundProps">
		<template v-if="result.isBlock">
			<Block v-for="(node, index) in result.nodes" :key="node.id" :node="node" :block-index="index" />
		</template>
		<template v-else>
			<Token v-for="node in result.nodes" :key="node.id" :node="node" :depth="0" />
		</template>
	</component>
</template>
