<script setup lang="ts">
import {getAlwaysShowHandleDrag} from '@markput/core'
import type {Token as TokenType} from '@markput/core'
import {computed} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'

import styles from '@markput/core/styles.module.css'

const props = defineProps<{token: TokenType; blockIndex: number}>()

const store = useStore()
const readOnly = useMarkput(s => s.props.readOnly)
const drag = useMarkput(s => s.props.drag)
const blockStore = store.blocks.get(props.token)
const isDragging = useMarkput(() => blockStore.state.isDragging)
const isHovered = useMarkput(() => blockStore.state.isHovered)
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
