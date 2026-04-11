<script setup lang="ts">
import {getAlwaysShowHandleDrag} from '@markput/core'
import type {Token as TokenType} from '@markput/core'
import {computed} from 'vue'

import {useStore} from '../lib/hooks/useStore'

import styles from '@markput/core/styles.module.css'

const props = defineProps<{token: TokenType; blockIndex: number}>()

const store = useStore()
const readOnly = store.props.readOnly.use()
const drag = store.props.drag.use()
const blockStore = store.blocks.get(props.token)
const isDragging = blockStore.state.isDragging.use()
const isHovered = blockStore.state.isHovered.use()
const alwaysShowHandle = computed(() => getAlwaysShowHandleDrag(drag.value))
</script>

<template>
	<div
		v-if="!readOnly"
		:class="[
			styles.SidePanel,
			alwaysShowHandle ? styles.SidePanelAlways : isHovered && !isDragging && styles.SidePanelVisible,
		]"
	>
		<button
			:ref="el => blockStore.attachGrip(el as HTMLButtonElement | null, props.blockIndex, store.event)"
			type="button"
			draggable="true"
			:class="[styles.GripButton, isDragging && styles.GripButtonDragging]"
			aria-label="Drag to reorder or click for options"
		>
			<span :class="`${styles.Icon} ${styles.IconGrip}`" />
		</button>
	</div>
</template>
