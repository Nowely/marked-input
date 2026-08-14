<script setup lang="ts">
import type {CSSProperties, TreeNode} from '@markput/core'
import {computed} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import {unwrapEl} from '../lib/unwrapEl'
import BlockMenu from './BlockMenu.vue'
import DragHandle from './DragHandle.vue'
import DropIndicator from './DropIndicator.vue'
import Token from './Token.vue'

import styles from '@markput/core/styles.module.css'

const props = defineProps<{node: TreeNode; blockIndex: number}>()

const store = useStore()
const blockStore = store.block.get(props.node)

const blockComponent = useMarkput(s => s.slots.blockComponent)
const slotProps = useMarkput(s => s.slots.blockProps)
const isDragging = useMarkput(() => blockStore.state.isDragging)

const blockStyle = computed(() => ({
	opacity: isDragging.value ? 0.4 : 1,
	...(slotProps.value?.style as CSSProperties | undefined),
}))

// Strip style and className before v-bind to avoid double-application
const otherSlotProps = computed(() => {
	if (!slotProps.value) return undefined
	const {style: _s, className: _c, ...rest} = slotProps.value
	return Object.keys(rest).length > 0 ? rest : undefined
})

const setBlockRef = (el: unknown) => {
	const element = unwrapEl(el)
	blockStore.attachContainer(element, props.blockIndex, {action: store.block.action})
}
</script>

<template>
	<component
		:is="blockComponent"
		:ref="setBlockRef"
		v-bind="otherSlotProps"
		:class="[styles.Block, slotProps?.className as string | undefined]"
		:style="blockStyle"
	>
		<DropIndicator :node="node" position="before" />
		<DragHandle :node="node" :block-index="blockIndex" />
		<Token :node="node" :depth="0" />
		<DropIndicator :node="node" position="after" />
		<BlockMenu :node="node" />
	</component>
</template>
