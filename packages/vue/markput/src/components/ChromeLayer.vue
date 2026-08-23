<script setup lang="ts">
import {BLOCK_MENU_ITEMS, getAlwaysShowHandle} from '@markput/core'
import type {RowBox} from '@markput/core'
import {computed, onScopeDispose, ref, watchEffect} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import {unwrapEl} from '../lib/unwrapEl'
import List from './Popup/List.vue'
import ListItem from './Popup/ListItem.vue'
import Popup from './Popup/Popup.vue'

import styles from '@markput/core/styles.module.css'

/**
 * ONE absolutely positioned chrome layer per editor — the Vue mirror of the React
 * `ChromeLayer`, over the SAME `ChromeModel`. Every decision is core's: the hover pin, the
 * hit-test, the drop edge and the menu's row all live there, so this file is a painter.
 */
const store = useStore()
const chrome = store.chrome

const readOnly = useMarkput(s => s.props.readOnly)
const draggable = useMarkput(s => s.props.draggable)
const rows = useMarkput(s => s.tokens.nodes)
const hovered = useMarkput(() => chrome.state.hovered)
const dragging = useMarkput(() => chrome.state.dragging)
const drop = useMarkput(() => chrome.state.drop)
const menu = useMarkput(() => chrome.state.menu)
const geometry = useMarkput(() => chrome.state.geometry)

const controlRef = store.tokens.control()
const setLayerRef = (el: unknown) => controlRef(unwrapEl(el))
const setMenuRef = (el: HTMLElement | null) => chrome.menuElement(el)

const alwaysShowHandle = computed(() => getAlwaysShowHandle(draggable.value))

// The row the grip decorates: the dragged row while a drag is live, else the hovered one. The
// fallback is what `alwaysShowHandle` now means — one layer cannot paint a grip on every row,
// so the option is "one grip, on the row nearest the pointer", resting on the first row while
// the pointer is away. DECLARED BEHAVIOUR CHANGE on a published option.
const gripRow = computed<number | null>(
	() => dragging.value ?? hovered.value ?? (alwaysShowHandle.value ? (rows.value[0]?.id ?? null) : null)
)
const dropRow = computed<number | null>(() => drop.value?.id ?? null)

// Geometry is MEASURED, not inherited from a `position: relative` ancestor: `geometry` is the
// container's resize/scroll clock and `flush: 'post'` puts the read after this patch painted.
const gripBox = ref<RowBox | null>(null)
const dropBox = ref<RowBox | null>(null)
const measure = () => {
	gripBox.value = gripRow.value === null ? null : (chrome.boxOf(gripRow.value) ?? null)
	dropBox.value = dropRow.value === null ? null : (chrome.boxOf(dropRow.value) ?? null)
}
watchEffect(
	() => {
		void geometry.value
		void gripRow.value
		void dropRow.value
		measure()
	},
	{flush: 'post'}
)

// A row that GROWS as the user types moves the grip with it, and the container's own observer
// says nothing when the container's size is fixed. Observing the ONE decorated row is the
// cheapest correct trigger.
let observer: ResizeObserver | undefined
watchEffect(
	() => {
		observer?.disconnect()
		observer = undefined
		const id = gripRow.value
		if (id === null) return
		const element = store.tokens.handle(id)?.element()
		if (!element) return
		observer = new ResizeObserver(() => {
			gripBox.value = chrome.boxOf(id) ?? null
		})
		observer.observe(element)
	},
	{flush: 'post'}
)
onScopeDispose(() => observer?.disconnect())

// `left` is the ROW's left edge; `.SidePanel`'s negative margin hangs the band off it. The
// layer's own origin would put it on top of the text wherever core reserves no gutter
// (`draggable: false`).
const gripStyle = computed(() => ({
	top: `${gripBox.value?.top ?? 0}px`,
	left: `${gripBox.value?.left ?? 0}px`,
	height: `${gripBox.value?.height ?? 0}px`,
}))
const dropStyle = computed(() => {
	const box = dropBox.value
	const edge = drop.value?.edge
	if (!box || !edge) return undefined
	return {
		top: `${edge === 'before' ? box.top - 1 : box.top + box.height - 1}px`,
		left: `${box.left}px`,
		width: `${box.width}px`,
	}
})
</script>

<template>
	<div :ref="setLayerRef" :class="styles.ChromeLayer">
		<!-- Painted but INVISIBLE while its row is being dragged, as the per-row panel was: the
		     grip stays mounted so its own `dragend` still fires (Chromium sends no mouseup for a
		     drag), and the pointer is away with the drag image anyway. -->
		<div
			v-if="!readOnly && gripRow !== null && gripBox"
			:class="[
				styles.SidePanel,
				alwaysShowHandle ? styles.SidePanelAlways : dragging === null && styles.SidePanelVisible,
			]"
			:style="gripStyle"
		>
			<!-- The grip is also the menu trigger, so it renders in block mode regardless;
			     `draggable` gates only the drag affordance it carries. -->
			<button
				type="button"
				:draggable="!!draggable"
				:class="[styles.GripButton, dragging !== null && styles.GripButtonDragging]"
				:aria-label="draggable ? 'Drag to reorder or click for options' : 'Block options'"
				@mousedown="chrome.pinHover()"
				@dragstart="e => chrome.beginDrag(gripRow!, e)"
				@dragend="chrome.endDrag()"
				@click.prevent="
					e => chrome.openMenu(gripRow!, (e.currentTarget as HTMLElement).getBoundingClientRect())
				"
			>
				<span :class="`${styles.Icon} ${styles.IconGrip}`" />
			</button>
		</div>

		<div v-if="dropStyle" :class="styles.DropIndicator" :style="dropStyle" />

		<Popup
			v-if="menu"
			:attach-ref="setMenuRef"
			:style="{top: menu.top + 'px', left: menu.left + 'px', pointerEvents: 'auto'}"
		>
			<List>
				<ListItem v-for="item in BLOCK_MENU_ITEMS" :key="item.label" @mousedown.prevent="item.run(chrome)">
					<span :class="item.iconClass" />
					<span>{{ item.label }}</span>
				</ListItem>
			</List>
		</Popup>
	</div>
</template>
