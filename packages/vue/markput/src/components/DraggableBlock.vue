<script setup lang="ts">
import {ref, computed, type CSSProperties} from 'vue'

const props = defineProps<{
	blockIndex: number
	readOnly: boolean
}>()

const emit = defineEmits<{
	reorder: [sourceIndex: number, targetIndex: number]
}>()

const isHovered = ref(false)
const isDragging = ref(false)
const dropPosition = ref<'before' | 'after' | null>(null)
const blockRef = ref<HTMLDivElement | null>(null)

const HANDLE_BASE: CSSProperties = {
	position: 'absolute',
	left: '-28px',
	top: '2px',
	width: '20px',
	height: '20px',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	cursor: 'grab',
	borderRadius: '4px',
	transition: 'opacity 0.15s ease',
	userSelect: 'none',
	color: '#9ca3af',
	background: 'none',
	border: 'none',
	padding: '0',
	margin: '0',
	font: 'inherit',
	lineHeight: '1',
}

const blockStyle = computed<CSSProperties>(() => ({
	position: 'relative',
	paddingLeft: '4px',
	transition: 'opacity 0.2s ease',
	opacity: isDragging.value ? 0.4 : 1,
}))

const handleStyle = computed<CSSProperties>(() => {
	if (props.readOnly) return {...HANDLE_BASE, display: 'none'}
	if (isDragging.value) return {...HANDLE_BASE, opacity: 1, cursor: 'grabbing'}
	if (isHovered.value) return {...HANDLE_BASE, opacity: 1}
	return {...HANDLE_BASE, opacity: 0}
})

const dropIndicatorStyle: CSSProperties = {
	position: 'absolute',
	left: '0',
	right: '0',
	height: '2px',
	backgroundColor: '#3b82f6',
	borderRadius: '1px',
	pointerEvents: 'none',
	zIndex: 10,
}

function onDragStart(e: DragEvent) {
	e.dataTransfer!.effectAllowed = 'move'
	e.dataTransfer!.setData('text/plain', String(props.blockIndex))
	isDragging.value = true
	if (blockRef.value) {
		e.dataTransfer!.setDragImage(blockRef.value, 0, 0)
	}
}

function onDragEnd() {
	isDragging.value = false
}

function onDragOver(e: DragEvent) {
	e.preventDefault()
	e.dataTransfer!.dropEffect = 'move'
	if (!blockRef.value) return
	const rect = blockRef.value.getBoundingClientRect()
	const midY = rect.top + rect.height / 2
	dropPosition.value = e.clientY < midY ? 'before' : 'after'
}

function onDragLeave() {
	dropPosition.value = null
}

function onDrop(e: DragEvent) {
	e.preventDefault()
	const sourceIndex = parseInt(e.dataTransfer!.getData('text/plain'), 10)
	if (isNaN(sourceIndex)) return
	const targetIndex = dropPosition.value === 'before' ? props.blockIndex : props.blockIndex + 1
	dropPosition.value = null
	emit('reorder', sourceIndex, targetIndex)
}
</script>

<template>
	<div
		ref="blockRef"
		:style="blockStyle"
		@mouseenter="isHovered = true"
		@mouseleave="isHovered = false"
		@dragover="onDragOver"
		@dragleave="onDragLeave"
		@drop="onDrop"
	>
		<div v-if="dropPosition === 'before'" :style="{...dropIndicatorStyle, top: '-1px'}" />

		<button
			type="button"
			:draggable="!readOnly"
			:style="handleStyle"
			aria-label="Drag to reorder"
			@dragstart="onDragStart"
			@dragend="onDragEnd"
		>
			<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
				<circle cx="5" cy="3" r="1.5" />
				<circle cx="11" cy="3" r="1.5" />
				<circle cx="5" cy="8" r="1.5" />
				<circle cx="11" cy="8" r="1.5" />
				<circle cx="5" cy="13" r="1.5" />
				<circle cx="11" cy="13" r="1.5" />
			</svg>
		</button>

		<slot />

		<div v-if="dropPosition === 'after'" :style="{...dropIndicatorStyle, bottom: '-1px'}" />
	</div>
</template>
