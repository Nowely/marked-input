<script setup lang="ts">
import {ref, computed, watch, onUnmounted, nextTick, type CSSProperties} from 'vue'

import styles from '@markput/core/styles.module.css'

const props = defineProps<{
	blockIndex: number
	readOnly: boolean
	alwaysShowHandle?: boolean
}>()

const emit = defineEmits<{
	reorder: [sourceIndex: number, targetIndex: number]
	add: [afterIndex: number]
	delete: [index: number]
	duplicate: [index: number]
}>()

const isHovered = ref(false)
const isDragging = ref(false)
const dropPosition = ref<'before' | 'after' | null>(null)
const menuOpen = ref(false)
const menuTop = ref(0)
const menuLeft = ref(0)
const hoveredMenuItem = ref<string | null>(null)
const blockRef = ref<HTMLDivElement | null>(null)
const gripRef = ref<HTMLButtonElement | null>(null)
const menuRef = ref<HTMLDivElement | null>(null)

const blockStyle = computed<CSSProperties>(() => ({
	position: 'relative',
	marginLeft: '0',
	paddingLeft: props.readOnly ? '0' : '32px',
	transition: 'opacity 0.2s ease',
	opacity: isDragging.value ? 0.4 : 1,
	background: 'transparent',
	borderRadius: '3px',
	minHeight: '1.2em',
	userSelect: 'none',
	outline: 'none',
}))

const sidePanelStyle = computed<CSSProperties>(() => ({
	position: 'absolute',
	left: '4px',
	top: '0',
	bottom: '0',
	width: '24px',
	display: 'flex',
	alignItems: 'center',
	opacity: props.alwaysShowHandle || (isHovered.value && !isDragging.value) ? 1 : 0,
	transition: props.alwaysShowHandle ? undefined : 'opacity 0.15s ease',
	pointerEvents: props.alwaysShowHandle || isHovered.value ? 'auto' : 'none',
}))

const SIDE_BUTTON_STYLE: CSSProperties = {
	width: '24px',
	height: '24px',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	cursor: 'pointer',
	borderRadius: '4px',
	color: '#9ca3af',
	background: 'none',
	border: 'none',
	padding: '0',
	margin: '0',
	font: 'inherit',
	lineHeight: '1',
	flexShrink: 0,
	userSelect: 'none',
}

const gripStyle = computed<CSSProperties>(() => ({
	...SIDE_BUTTON_STYLE,
	cursor: isDragging.value ? 'grabbing' : 'grab',
}))

const dropIndicatorStyle = computed<CSSProperties>(() => ({
	position: 'absolute',
	left: props.readOnly ? '0' : '32px',
	right: '0',
	height: '2px',
	backgroundColor: '#3b82f6',
	borderRadius: '1px',
	pointerEvents: 'none',
	zIndex: 10,
}))

const menuStyle = computed<CSSProperties>(() => ({
	position: 'fixed',
	top: `${menuTop.value}px`,
	left: `${menuLeft.value}px`,
	background: 'white',
	border: '1px solid rgba(55, 53, 47, 0.16)',
	borderRadius: '6px',
	boxShadow: '0 4px 16px rgba(15, 15, 15, 0.12)',
	padding: '4px',
	zIndex: 9999,
	minWidth: '160px',
	fontSize: '14px',
}))

function menuItemStyle(key: string): CSSProperties {
	return {
		display: 'flex',
		alignItems: 'center',
		gap: '8px',
		padding: '7px 12px',
		borderRadius: '4px',
		cursor: 'pointer',
		color: key === 'delete' ? '#eb5757' : 'rgba(55, 53, 47, 0.85)',
		background:
			hoveredMenuItem.value === key
				? key === 'delete'
					? 'rgba(235, 87, 87, 0.06)'
					: 'rgba(55, 53, 47, 0.06)'
				: 'transparent',
		transition: 'background 0.1s ease',
		userSelect: 'none',
		lineHeight: '1',
	}
}

function onDragStart(e: DragEvent) {
	if (!e.dataTransfer) return
	e.dataTransfer.effectAllowed = 'move'
	e.dataTransfer.setData('text/plain', String(props.blockIndex))
	isDragging.value = true
	if (blockRef.value) {
		e.dataTransfer.setDragImage(blockRef.value, 0, 0)
	}
}

function onDragEnd() {
	isDragging.value = false
	dropPosition.value = null
}

function onDragOver(e: DragEvent) {
	e.preventDefault()
	if (!e.dataTransfer) return
	e.dataTransfer.dropEffect = 'move'
	if (!blockRef.value) return
	const rect = blockRef.value.getBoundingClientRect()
	const midY = rect.top + rect.height / 2
	dropPosition.value = e.clientY < midY ? 'before' : 'after'
}

function onDragLeave(e: DragEvent) {
	if ((e.currentTarget as HTMLElement)?.contains(e.relatedTarget as Node)) return
	dropPosition.value = null
}

function onDrop(e: DragEvent) {
	e.preventDefault()
	if (!e.dataTransfer) return
	const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
	if (isNaN(sourceIndex)) return
	const targetIndex = dropPosition.value === 'before' ? props.blockIndex : props.blockIndex + 1
	dropPosition.value = null
	emit('reorder', sourceIndex, targetIndex)
}

function onGripClick(e: MouseEvent) {
	e.preventDefault()
	if (!gripRef.value) return
	const rect = gripRef.value.getBoundingClientRect()
	menuTop.value = rect.bottom + 4
	menuLeft.value = rect.left
	menuOpen.value = true
}

function closeMenu() {
	menuOpen.value = false
}

function onMouseDownOutside(e: MouseEvent) {
	if (menuRef.value && !menuRef.value.contains(e.target as Node)) closeMenu()
}
function onKeyDownEscape(e: KeyboardEvent) {
	if (e.key === 'Escape') closeMenu()
}

let cleanupMenuListeners: (() => void) | null = null

watch(menuOpen, async open => {
	if (open) {
		await nextTick()
		document.addEventListener('mousedown', onMouseDownOutside)
		document.addEventListener('keydown', onKeyDownEscape)
		cleanupMenuListeners = () => {
			document.removeEventListener('mousedown', onMouseDownOutside)
			document.removeEventListener('keydown', onKeyDownEscape)
		}
	} else {
		cleanupMenuListeners?.()
		cleanupMenuListeners = null
	}
})

onUnmounted(() => cleanupMenuListeners?.())

function onMenuDelete() {
	emit('delete', props.blockIndex)
	closeMenu()
}

function onMenuAdd() {
	emit('add', props.blockIndex)
	closeMenu()
}

function onMenuDuplicate() {
	emit('duplicate', props.blockIndex)
	closeMenu()
}
</script>

<template>
	<div
		ref="blockRef"
		data-testid="block"
		:style="blockStyle"
		@mouseenter="isHovered = true"
		@mouseleave="isHovered = false"
		@dragover="onDragOver"
		@dragleave="onDragLeave"
		@drop="onDrop"
	>
		<div v-if="dropPosition === 'before'" :style="{...dropIndicatorStyle, top: '-1px'}" />

		<div v-if="!readOnly" :style="sidePanelStyle">
			<button
				ref="gripRef"
				type="button"
				draggable="true"
				:style="gripStyle"
				aria-label="Drag to reorder or click for options"
				@dragstart="onDragStart"
				@dragend="onDragEnd"
				@click="onGripClick"
			>
				<span :class="[styles.Icon, styles.IconGrip]" />
			</button>
		</div>

		<slot><br /></slot>

		<div v-if="dropPosition === 'after'" :style="{...dropIndicatorStyle, bottom: '-1px'}" />

		<Teleport to="body">
			<div v-if="menuOpen" ref="menuRef" :style="menuStyle" @mousedown.stop>
				<div
					:style="menuItemStyle('add')"
					@mouseenter="hoveredMenuItem = 'add'"
					@mouseleave="hoveredMenuItem = null"
					@mousedown.prevent="onMenuAdd"
				>
					<span :class="[styles.Icon, styles.IconAdd]" />
					<span>Add below</span>
				</div>
				<div
					:style="menuItemStyle('duplicate')"
					@mouseenter="hoveredMenuItem = 'duplicate'"
					@mouseleave="hoveredMenuItem = null"
					@mousedown.prevent="onMenuDuplicate"
				>
					<span :class="[styles.Icon, styles.IconDuplicate]" />
					<span>Duplicate</span>
				</div>
				<div style="height: 1px; background: rgba(55, 53, 47, 0.09); margin: 4px 0" />
				<div
					:style="menuItemStyle('delete')"
					@mouseenter="hoveredMenuItem = 'delete'"
					@mouseleave="hoveredMenuItem = null"
					@mousedown.prevent="onMenuDelete"
				>
					<span :class="[styles.Icon, styles.IconTrash]" />
					<span>Delete</span>
				</div>
			</div>
		</Teleport>
	</div>
</template>
