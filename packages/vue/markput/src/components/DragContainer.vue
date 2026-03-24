<script setup lang="ts">
import {resolveSlot, resolveSlotProps, tokensToBlocks, getAlwaysShowHandleDrag} from '@markput/core'
import type {Component} from 'vue'
import {computed} from 'vue'

import {useStore} from '../lib/hooks/useStore'
import DragMark from './DragMark.vue'
import Token from './Token.vue'

const store = useStore()
const tokens = store.state.tokens.use()
const slots = store.state.slots.use()
const slotProps = store.state.slotProps.use()
const className = store.state.className.use()
const style = store.state.style.use()
const readOnly = store.state.readOnly.use()
const drag = store.state.drag.use()
const alwaysShowHandle = computed(() => getAlwaysShowHandleDrag(drag.value))
const key = store.key
const dragCtrl = store.controllers.drag

const containerTag = computed(() => resolveSlot<string | Component>('container', slots.value))
const containerProps = computed(() => resolveSlotProps('container', slotProps.value))

const blocks = computed(() => tokensToBlocks(tokens.value, key))
</script>

<template>
	<component
		:is="containerTag"
		:ref="(el: HTMLDivElement | null) => (store.refs.container = el)"
		v-bind="containerProps"
		:class="className"
		:style="style"
	>
		<DragMark
			v-for="(block, index) in blocks"
			:key="block.id"
			:block-index="index"
			:read-only="readOnly"
			:always-show-handle="alwaysShowHandle"
			@reorder="(s, t) => dragCtrl.reorder(s, t)"
			@add="i => dragCtrl.add(i)"
			@delete="i => dragCtrl.delete(i)"
			@duplicate="i => dragCtrl.duplicate(i)"
		>
			<Token v-for="token in block.tokens" :key="key.get(token)" :mark="token" />
		</DragMark>
	</component>
</template>
