<script setup lang="ts">
import {resolveSlot, resolveSlotProps} from '@markput/core'
import type {Component} from 'vue'
import {computed} from 'vue'

import {useStore} from '../lib/hooks/useStore'
import Block from './Block.vue'
import Token from './Token.vue'

const store = useStore()
const drag = store.state.drag.use()
const readOnly = store.state.readOnly.use()
const tokens = store.state.tokens.use()
const slots = store.state.slots.use()
const slotProps = store.state.slotProps.use()
const className = store.state.className.use()
const style = store.state.style.use()
const key = store.key

const containerTag = computed(() => resolveSlot<string | Component>('container', slots.value))
const containerProps = computed(() => resolveSlotProps('container', slotProps.value))
const containerStyle = computed(() => (drag.value && !readOnly.value ? {paddingLeft: 24, ...style.value} : style.value))
</script>

<template>
	<component
		:is="containerTag"
		:ref="
			(el: any) => {
				store.refs.container = el?.$el ?? el
			}
		"
		v-bind="containerProps"
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
