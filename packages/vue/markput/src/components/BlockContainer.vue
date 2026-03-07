<script setup lang="ts">
import type {Token as CoreToken} from '@markput/core'
import {splitTokensIntoBlocks, reorderBlocks, parseWithParser} from '@markput/core'
import {computed} from 'vue'

import {useStore} from '../lib/hooks/useStore'
import {resolveSlot, resolveSlotProps} from '../lib/slots'
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

const containerTag = computed(() => resolveSlot('container', slots.value))
const containerProps = computed(() => resolveSlotProps('container', slotProps.value))

const blocks = computed(() => splitTokensIntoBlocks(tokens.value))

function handleReorder(sourceIndex: number, targetIndex: number) {
	if (!value.value || !onChange.value) return
	const newValue = reorderBlocks(value.value, blocks.value, sourceIndex, targetIndex)
	if (newValue !== value.value) {
		const newTokens = parseWithParser(store, newValue)
		store.state.tokens.set(newTokens)
		store.state.previousValue.set(newValue)
		onChange.value(newValue)
	}
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
		>
			<Token v-for="token in block.tokens" :key="key.get(token)" :mark="token" />
		</DraggableBlock>
	</component>
</template>
