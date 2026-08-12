<script setup lang="ts">
import {getAlwaysShowHandle} from '@markput/core'
import type {TreeNode} from '@markput/core'
import {computed} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'

import styles from '@markput/core/styles.module.css'

const props = defineProps<{node: TreeNode; blockIndex: number}>()

const store = useStore()
const readOnly = useMarkput(s => s.props.readOnly)
const draggable = useMarkput(s => s.props.draggable)
const blockStore = store.block.get(props.node)
const isDragging = useMarkput(() => blockStore.state.isDragging)
const isHovered = useMarkput(() => blockStore.state.isHovered)
const alwaysShowHandle = computed(() => getAlwaysShowHandle(draggable.value))

const panelControlRef = store.tokens.control()

const setPanelRef = (el: unknown) => {
	panelControlRef(el as HTMLElement | null)
}

const setGripRef = (el: unknown) => {
	const element = el as HTMLButtonElement | null
	blockStore.attachGrip(element, props.blockIndex, {action: store.block.action})
}
</script>

<template>
	<div
		v-if="!readOnly"
		:ref="setPanelRef"
		:class="[
			styles.SidePanel,
			alwaysShowHandle ? styles.SidePanelAlways : isHovered && !isDragging && styles.SidePanelVisible,
		]"
	>
		<button
			:ref="setGripRef"
			type="button"
			:draggable="!!draggable"
			:class="[styles.GripButton, isDragging && styles.GripButtonDragging]"
			:aria-label="draggable ? 'Drag to reorder or click for options' : 'Block options'"
		>
			<span :class="`${styles.Icon} ${styles.IconGrip}`" />
		</button>
	</div>
</template>
