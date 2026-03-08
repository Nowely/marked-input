<script setup lang="ts">
import {ref, computed, watch, onUnmounted, nextTick, type CSSProperties} from 'vue'

const props = defineProps<{
	blockIndex: number
	readOnly: boolean
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
	opacity: isHovered.value && !isDragging.value ? 1 : 0,
	transition: 'opacity 0.15s ease',
	pointerEvents: isHovered.value ? 'auto' : 'none',
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
		color: key === 'delete' ? '#eb5757' : 'inherit',
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
				<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
					<circle cx="5" cy="3" r="1.5" />
					<circle cx="11" cy="3" r="1.5" />
					<circle cx="5" cy="8" r="1.5" />
					<circle cx="11" cy="8" r="1.5" />
					<circle cx="5" cy="13" r="1.5" />
					<circle cx="11" cy="13" r="1.5" />
				</svg>
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
					<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
						<path
							d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z"
						/>
					</svg>
					<span>Add below</span>
				</div>
				<div
					:style="menuItemStyle('duplicate')"
					@mouseenter="hoveredMenuItem = 'duplicate'"
					@mouseleave="hoveredMenuItem = null"
					@mousedown.prevent="onMenuDuplicate"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
						<path
							fill-rule="evenodd"
							clip-rule="evenodd"
							d="M10 9C9.44772 9 9 9.44772 9 10V20C9 20.5523 9.44772 21 10 21H20C20.5523 21 21 20.5523 21 20V10C21 9.44772 20.5523 9 20 9H10ZM7 10C7 8.34315 8.34315 7 10 7H20C21.6569 7 23 8.34315 23 10V20C23 21.6569 21.6569 23 20 23H10C8.34315 23 7 21.6569 7 20V10Z"
						/>
						<path
							fill-rule="evenodd"
							clip-rule="evenodd"
							d="M4 3C3.45228 3 3 3.45228 3 4V14C3 14.5477 3.45228 15 4 15C4.55228 15 5 15.4477 5 16C5 16.5523 4.55228 17 4 17C2.34772 17 1 15.6523 1 14V4C1 2.34772 2.34772 1 4 1H14C15.6523 1 17 2.34772 17 4C17 4.55228 16.5523 5 16 5C15.4477 5 15 4.55228 15 4C15 3.45228 14.5477 3 14 3H4Z"
						/>
					</svg>
					<span>Duplicate</span>
				</div>
				<div
					:style="menuItemStyle('delete')"
					@mouseenter="hoveredMenuItem = 'delete'"
					@mouseleave="hoveredMenuItem = null"
					@mousedown.prevent="onMenuDelete"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
						<path
							fill-rule="evenodd"
							clip-rule="evenodd"
							d="M7 5V4C7 3.17477 7.40255 2.43324 7.91789 1.91789C8.43324 1.40255 9.17477 1 10 1H14C14.8252 1 15.5668 1.40255 16.0821 1.91789C16.5975 2.43324 17 3.17477 17 4V5H21C21.5523 5 22 5.44772 22 6C22 6.55228 21.5523 7 21 7H20V20C20 20.8252 19.5975 21.5668 19.0821 22.0821C18.5668 22.5975 17.8252 23 17 23H7C6.17477 23 5.43324 22.5975 4.91789 22.0821C4.40255 21.5668 4 20.8252 4 20V7H3C2.44772 7 2 6.55228 2 6C2 5.44772 2.44772 5 3 5H7ZM9 4C9 3.82523 9.09745 3.56676 9.33211 3.33211C9.56676 3.09745 9.82523 3 10 3H14C14.1748 3 14.4332 3.09745 14.6679 3.33211C14.9025 3.56676 15 3.82523 15 4V5H9V4ZM6 7V20C6 20.1748 6.09745 20.4332 6.33211 20.6679C6.56676 20.9025 6.82523 21 7 21H17C17.1748 21 17.4332 20.9025 17.6679 20.6679C17.9025 20.4332 18 20.1748 18 20V7H6Z"
						/>
					</svg>
					<span>Delete</span>
				</div>
			</div>
		</Teleport>
	</div>
</template>
