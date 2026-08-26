<script setup lang="ts">
import {computed, onMounted, onUnmounted} from 'vue'

import {useOverlay} from '../../lib/hooks/useOverlay'
import List from '../Popup/List.vue'
import ListItem from '../Popup/ListItem.vue'
import Popup from '../Popup/Popup.vue'

/**
 * THE OVERLAY LIST, shipped, and the DEFAULT overlay — one component for both lists this adapter
 * used to ship. `Suggestions` painted `overlay.data` with arrows and Enter; `RowMenu` painted the
 * options' own `menu` entries with neither, so typing `/h2` and pressing Enter left the literal
 * text in the row and split it. The rows now come from one model with one keyboard, and the only
 * difference left between the two lists is where core reads them from.
 *
 * A consumer wires a row menu with `{overlay: {trigger: '/'}}` and nothing else: no component, no
 * filtering, no insert logic. `rows` and `choose` are core's, and this is the paint over them.
 */

// The option's config (`trigger`, `data`, …) arrives as props from `OverlayRenderer`, and this
// component declares none of them because it reads everything through the store. Vue would
// spill every undeclared prop onto the root element as an attribute; React drops them.
defineOptions({inheritAttrs: false})

const {rows, active, activate, choose, style: overlayStyle, ref: overlayRef} = useOverlay()

// `overlayStyle` carries the popup's position as bare numbers, the framework-free shape core
// computes. React's DOM layer appends `px` to a numeric `left`/`top`; Vue assigns the number
// to `style.left` verbatim, the CSSOM rejects the unitless length, and the `position: fixed`
// popup falls back to its static position at the host's left edge. The unit belongs to the
// binding, as in `RowControls.vue`'s menu.
const popupStyle = computed(() => ({left: `${overlayStyle.value.left}px`, top: `${overlayStyle.value.top}px`}))

// The keydown protocol lives exactly as long as this component: `activate` is opt-in so a custom
// overlay that is not a list keeps the arrows and Enter it never claimed.
let deactivate: (() => void) | undefined
onMounted(() => {
	deactivate = activate()
})
onUnmounted(() => deactivate?.())

function setOverlayRef(el: HTMLElement | null) {
	overlayRef.current = el
}
</script>

<template>
	<Popup v-if="rows.length" :style="popupStyle" :attach-ref="setOverlayRef">
		<List>
			<ListItem
				v-for="(row, index) in rows"
				:key="row.label"
				:active="index === active"
				@click="choose(row.pick)"
			>
				{{ row.label }}
			</ListItem>
		</List>
	</Popup>
</template>
