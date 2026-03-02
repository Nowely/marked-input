<script setup lang="ts">
import {computed} from 'vue'
import {resolveSlot, resolveSlotProps} from '../lib/utils/resolveSlot'
import {useStore} from '../lib/hooks/useStore'
import Token from './Token.vue'

const store = useStore()
const tokens = store.state.tokens.use()
const slots = store.state.slots.use()
const slotProps = store.state.slotProps.use()
const className = store.state.className.use()
const style = store.state.style.use()
const key = store.key

console.log('Container rendered, tokens length:', tokens.value?.length)

const containerTag = computed(() => resolveSlot('container', slots.value))
const containerProps = computed(() => resolveSlotProps('container', slotProps.value))
</script>

<template>
	<component
		:is="containerTag"
		:ref="(el: any) => (store.refs.container = el)"
		v-bind="containerProps"
		:class="className"
		:style="style"
	>
		<Token v-for="token in tokens" :key="key.get(token)" :mark="token" />
	</component>
</template>
