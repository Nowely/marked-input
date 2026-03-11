<script setup lang="ts">
import {
	resolveSlot,
	resolveSlotProps,
	splitTokensIntoBlocks,
	splitTokensIntoDragRows,
	reorderBlocks,
	reorderDragRows,
	addBlock,
	addDragRow,
	deleteBlock,
	deleteDragRow,
	duplicateBlock,
	duplicateDragRow,
	getAlwaysShowHandle,
	getAlwaysShowHandleDrag,
} from '@markput/core'
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
const block = store.state.block.use()
const drag = store.state.drag.use()
const isDragMode = computed(() => !!drag.value)
const alwaysShowHandle = computed(() =>
	isDragMode.value ? getAlwaysShowHandleDrag(drag.value) : getAlwaysShowHandle(block.value)
)
const value = store.state.value.use()
const onChange = store.state.onChange.use()
const key = store.key

const containerTag = computed(() => resolveSlot<string | Component>('container', slots.value))
const containerProps = computed(() => resolveSlotProps('container', slotProps.value))

const blocks = computed(() =>
	isDragMode.value ? splitTokensIntoDragRows(tokens.value) : splitTokensIntoBlocks(tokens.value)
)

function handleReorder(sourceIndex: number, targetIndex: number) {
	if (!value.value || !onChange.value) return
	const newValue = isDragMode.value
		? reorderDragRows(value.value, blocks.value, sourceIndex, targetIndex)
		: reorderBlocks(value.value, blocks.value, sourceIndex, targetIndex)
	if (newValue !== value.value) store.applyValue(newValue)
}

function handleAdd(afterIndex: number) {
	if (!value.value || !onChange.value) return
	store.applyValue(
		isDragMode.value
			? addDragRow(value.value, blocks.value, afterIndex)
			: addBlock(value.value, blocks.value, afterIndex)
	)
}

function handleDelete(index: number) {
	if (!value.value || !onChange.value) return
	store.applyValue(
		isDragMode.value
			? deleteDragRow(value.value, blocks.value, index)
			: deleteBlock(value.value, blocks.value, index)
	)
}

function handleDuplicate(index: number) {
	if (!value.value || !onChange.value) return
	store.applyValue(
		isDragMode.value
			? duplicateDragRow(value.value, blocks.value, index)
			: duplicateBlock(value.value, blocks.value, index)
	)
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
			:always-show-handle="alwaysShowHandle"
			@reorder="handleReorder"
			@add="handleAdd"
			@delete="handleDelete"
			@duplicate="handleDuplicate"
		>
			<Token v-for="token in block.tokens" :key="key.get(token)" :mark="token" />
		</DraggableBlock>
	</component>
</template>
