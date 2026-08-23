<script setup lang="ts">
import {computed, onMounted, onUnmounted} from 'vue'

import {useMarkput} from '../../lib/hooks/useMarkput'
import {useOverlay} from '../../lib/hooks/useOverlay'
import {useStore} from '../../lib/hooks/useStore'
import List from '../Popup/List.vue'
import ListItem from '../Popup/ListItem.vue'
import Popup from '../Popup/Popup.vue'

// The option's config (`trigger`, `data`, …) arrives as props from `OverlayRenderer`, and this
// component declares none of them because it reads everything through the store. Vue would
// spill every undeclared prop onto the root element as an attribute; React drops them.
defineOptions({inheritAttrs: false})

const suggestions = useStore().overlay.suggestions
const {style: overlayStyle, ref: overlayRef} = useOverlay()
const filtered = useMarkput(s => s.overlay.suggestions.filtered)
const active = useMarkput(s => s.overlay.suggestions.active)

// `overlayStyle` carries the caret position as bare numbers, the framework-free shape core
// computes. React's DOM layer appends `px` to a numeric `left`/`top`; Vue assigns the number
// to `style.left` verbatim, the CSSOM rejects the unitless length, and the `position: fixed`
// popup falls back to its static position at the host's left edge. The unit belongs to the
// binding, as in `BlockControls.vue`'s menu.
const popupStyle = computed(() => ({left: `${overlayStyle.value.left}px`, top: `${overlayStyle.value.top}px`}))

let deactivate: (() => void) | undefined
onMounted(() => {
	deactivate = suggestions.activate()
})
onUnmounted(() => deactivate?.())

function setOverlayRef(el: HTMLElement | null) {
	overlayRef.current = el
}
</script>

<template>
	<Popup v-if="filtered.length" :style="popupStyle" :attach-ref="setOverlayRef">
		<List>
			<ListItem
				v-for="(suggestion, index) in filtered"
				:key="suggestion"
				:active="index === active"
				@click="suggestions.select(index)"
			>
				{{ suggestion }}
			</ListItem>
		</List>
	</Popup>
</template>
