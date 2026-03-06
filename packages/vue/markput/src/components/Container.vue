<script setup lang="ts">
import type {CoreSlotProps, CoreSlots, Token as CoreToken} from '@markput/core'
import {computed, type Ref} from 'vue'

import {useStore} from '../lib/hooks/useStore'
import {resolveSlot, resolveSlotProps} from '../lib/utils/resolveSlot'
import Token from './Token.vue'

const store = useStore()
const tokens = store.state.tokens.use() as unknown as Ref<CoreToken[]>
const slots = store.state.slots.use() as unknown as Ref<CoreSlots | undefined>
const slotProps = store.state.slotProps.use() as unknown as Ref<CoreSlotProps | undefined>
const className = store.state.className.use()
const style = store.state.style.use()
const key = store.key

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
