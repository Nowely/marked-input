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
 * ONE absolutely positioned row-controls layer per editor — the Vue mirror of the React
 * `BlockControls`, over the SAME `BlockController`. Every decision is core's: the hover pin, the
 * hit-test, the drop edge and the menu's row all live there, so this file is a painter.
 *
 * `BlockControls`, not `BlockLayer`: `Block.vue` is the row WRAPPER, and two near-identical names
 * beside each other is the ambiguity this one is named to avoid.
 */
const store = useStore()
const block = store.block

const readOnly = useMarkput(s => s.props.readOnly)
const draggable = useMarkput(s => s.props.draggable)
const rows = useMarkput(s => s.tokens.nodes)
const hovered = useMarkput(() => block.state.hovered)
const dragging = useMarkput(() => block.state.dragging)
const drop = useMarkput(() => block.state.drop)
const menu = useMarkput(() => block.state.menu)
const geometry = useMarkput(() => block.state.geometry)

const controlRef = store.tokens.control()
const setLayerRef = (el: unknown) => controlRef(unwrapEl(el))
const setMenuRef = (el: HTMLElement | null) => block.menuElement(el)

const alwaysShowHandle = computed(() => getAlwaysShowHandle(draggable.value))

// The row the grip decorates: the dragged row while a drag is live, else the hovered one. The
// fallback is what `alwaysShowHandle` now means — one layer cannot paint a grip on every row,
// so the option is "one grip, on the row nearest the pointer", resting on the first row while
// the pointer is away. DECLARED BEHAVIOUR CHANGE on a published option.
const gripRow = computed<number | null>(
	() => dragging.value ?? hovered.value ?? (alwaysShowHandle.value ? (rows.value[0]?.id ?? null) : null)
)

// Geometry is MEASURED, not inherited from a `position: relative` ancestor: `geometry` is the
// container's resize/scroll clock and `flush: 'post'` puts the read after this patch painted.
//
// The GRIP alone: the drop indicator's line arrives already resolved on `state.drop`, measured by
// the `dragover` that resolved the placement it will perform, so the layer cannot paint an
// indicator anywhere but where the drop will land.
const gripBox = ref<RowBox | null>(null)
watchEffect(
	() => {
		void geometry.value
		gripBox.value = gripRow.value === null ? null : (block.boxOf(gripRow.value) ?? null)
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
			gripBox.value = block.boxOf(id) ?? null
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
// `left` says the DEPTH the drop will land at: core indents the line by the measured indent unit,
// so the indicator answers "where" and "how deep" at once.
const dropStyle = computed(() => {
	const line = drop.value?.line
	if (!line) return undefined
	return {top: `${line.top - 1}px`, left: `${line.left}px`, width: `${line.width}px`}
})
</script>

<template>
	<div :ref="setLayerRef" :class="styles.BlockControls">
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
				@mousedown="block.pinHover()"
				@dragstart="e => block.beginDrag(gripRow!, e)"
				@dragend="block.endDrag()"
				@click.prevent="e => block.openMenu(gripRow!, (e.currentTarget as HTMLElement).getBoundingClientRect())"
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
				<ListItem v-for="item in BLOCK_MENU_ITEMS" :key="item.label" @mousedown.prevent="item.run(block)">
					<span :class="item.iconClass" />
					<span>{{ item.label }}</span>
				</ListItem>
			</List>
		</Popup>
	</div>
</template>
