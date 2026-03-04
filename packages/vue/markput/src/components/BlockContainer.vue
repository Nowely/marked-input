<script setup lang="ts">
import {computed, type Ref} from 'vue'
import type {CoreSlotProps, CoreSlots, Token as CoreToken} from '@markput/core'
import {splitTokensIntoBlocks, reorderBlocks, parseWithParser} from '@markput/core'
import {resolveSlot, resolveSlotProps} from '../lib/utils/resolveSlot'
import {useStore} from '../lib/hooks/useStore'
import Token from './Token.vue'
import DraggableBlock from './DraggableBlock.vue'

const store = useStore()
const tokens = store.state.tokens.use() as unknown as Ref<CoreToken[]>
const slots = store.state.slots.use() as unknown as Ref<CoreSlots | undefined>
const slotProps = store.state.slotProps.use() as unknown as Ref<CoreSlotProps | undefined>
const className = store.state.className.use()
const style = store.state.style.use()
const readOnly = store.state.readOnly.use() as unknown as Ref<boolean>
const value = store.state.value.use() as unknown as Ref<string | undefined>
const onChange = store.state.onChange.use() as unknown as Ref<((v: string) => void) | undefined>
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
		:ref="(el: any) => (store.refs.container = el)"
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
