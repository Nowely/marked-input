<script setup lang="ts">
import type {Token as CoreToken} from '@markput/core'
import {resolveSlot, resolveSlotProps, splitTokensIntoBlocks, reorderBlocks, addBlock, deleteBlock, duplicateBlock, parseWithParser} from '@markput/core'
import type {Component} from 'vue'
import {computed} from 'vue'

import {useStore} from '../lib/hooks/useStore'
import DraggableBlock from './DraggableBlock.vue'
import Token from './Token.vue'

const store = useStore()
const tokens = store.state.tokens.use()
const slots = store.state.slots.use()
const slotProps = store.state.slotProps.use()
const className = store.state.className.use()
const style = store.state.style.use()
const readOnly = store.state.readOnly.use()
const value = store.state.value.use()
const onChange = store.state.onChange.use()
const key = store.key

const containerTag = computed(() => resolveSlot<string | Component>('container', slots.value))
const containerProps = computed(() => resolveSlotProps('container', slotProps.value))

const blocks = computed(() => splitTokensIntoBlocks(tokens.value))

function applyNewValue(newValue: string) {
	if (!onChange.value) return
	const newTokens = parseWithParser(store, newValue)
	store.state.tokens.set(newTokens)
	store.state.previousValue.set(newValue)
	onChange.value(newValue)
}

function handleReorder(sourceIndex: number, targetIndex: number) {
	if (!value.value || !onChange.value) return
	const newValue = reorderBlocks(value.value, blocks.value, sourceIndex, targetIndex)
	if (newValue !== value.value) applyNewValue(newValue)
}

function handleAdd(afterIndex: number) {
	if (!value.value || !onChange.value) return
	applyNewValue(addBlock(value.value, blocks.value, afterIndex))
}

function handleDelete(index: number) {
	if (!value.value || !onChange.value) return
	applyNewValue(deleteBlock(value.value, blocks.value, index))
}

function handleDuplicate(index: number) {
	if (!value.value || !onChange.value) return
	applyNewValue(duplicateBlock(value.value, blocks.value, index))
}
</script>

<template>
	<component
		:is="containerTag"
		:ref="(el: HTMLDivElement | null) => (store.refs.container = el)"
		v-bind="containerProps"
		:class="className"
		:style="style"
	>
		<DraggableBlock
			v-for="(block, index) in blocks"
			:key="block.id"
			:block-index="index"
			:read-only="readOnly"
			@reorder="handleReorder"
			@add="handleAdd"
			@delete="handleDelete"
			@duplicate="handleDuplicate"
		>
			<Token v-for="token in block.tokens" :key="key.get(token)" :mark="token" />
		</DraggableBlock>
	</component>
</template>
