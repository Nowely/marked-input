<script setup lang="ts">
import {getAlwaysShowHandle} from '@markput/core'
import type {Token as TokenType} from '@markput/core'
import {computed} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'

import styles from '@markput/core/styles.module.css'

const props = defineProps<{token: TokenType; blockIndex: number}>()

const store = useStore()
const readOnly = useMarkput(s => s.props.readOnly)
const draggable = useMarkput(s => s.props.draggable)
const index = useMarkput(s => s.parsing.index)
const blockStore = store.blocks.get(props.token)
const isDragging = useMarkput(() => blockStore.state.isDragging)
const isHovered = useMarkput(() => blockStore.state.isHovered)
const alwaysShowHandle = computed(() => getAlwaysShowHandle(draggable.value))

let panelControlRef: ((element: HTMLElement | null) => void) | undefined

const getPanelControlRef = () => {
	if (panelControlRef) return panelControlRef
	const path = index.value.pathFor(props.token)
	if (!path) return undefined
	panelControlRef = store.dom.controlFor(path)
	return panelControlRef
}

const setPanelRef = (el: unknown) => {
	getPanelControlRef()?.(el as HTMLElement | null)
}

const setGripRef = (el: unknown) => {
	const element = el as HTMLButtonElement | null
	blockStore.attachGrip(element, props.blockIndex, {action: store.drag.action})
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
			draggable="true"
			:class="[styles.GripButton, isDragging && styles.GripButtonDragging]"
			aria-label="Drag to reorder or click for options"
		>
			<span :class="`${styles.Icon} ${styles.IconGrip}`" />
		</button>
	</div>
</template>
