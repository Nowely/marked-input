<script setup lang="ts">
import {computed} from 'vue'

import {useOverlay} from '../../lib/hooks/useOverlay'
import List from '../Popup/List.vue'
import ListItem from '../Popup/ListItem.vue'
import Popup from '../Popup/Popup.vue'

/**
 * THE ROW MENU, shipped: one entry per option that declares a `menu`, already narrowed by what
 * the user typed after the trigger, and a click turns the caret's row into that kind.
 *
 * A consumer wires it with one line — `{overlay: {trigger: '/'}, Overlay: RowMenu}` — and a
 * consumer replacing it writes no filtering and no insert logic either: `entries` and `choose`
 * are core's, and this component is the paint over them.
 */

// The option's config (`trigger`, `data`, …) arrives as props from `OverlayRenderer`, and this
// component declares none of them because it reads everything through the store. Vue would
// spill every undeclared prop onto the root element as an attribute; React drops them.
defineOptions({inheritAttrs: false})

const {entries, choose, style: overlayStyle, ref: overlayRef} = useOverlay()

// `overlayStyle` carries the caret position as bare numbers, the framework-free shape core
// computes; the CSSOM rejects a unitless length, so the unit belongs to the binding. Same rule
// as `Suggestions.vue` and `BlockControls.vue`'s menu.
const popupStyle = computed(() => ({left: `${overlayStyle.value.left}px`, top: `${overlayStyle.value.top}px`}))

function setOverlayRef(el: HTMLElement | null) {
	overlayRef.current = el
}
</script>

<template>
	<Popup v-if="entries.length" :style="popupStyle" :attach-ref="setOverlayRef">
		<List>
			<ListItem v-for="entry in entries" :key="entry.label" @click="choose({option: entry.option})">
				{{ entry.label }}
			</ListItem>
		</List>
	</Popup>
</template>
