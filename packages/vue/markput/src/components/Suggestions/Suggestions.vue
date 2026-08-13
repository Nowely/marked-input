<script setup lang="ts">
import {filterSuggestions, navigateSuggestions} from '@markput/core'
import {ref, computed, onMounted, onUnmounted} from 'vue'

import {useOverlay} from '../../lib/hooks/useOverlay'
import {useStore} from '../../lib/hooks/useStore'
import List from '../Popup/List.vue'
import ListItem from '../Popup/ListItem.vue'
import Popup from '../Popup/Popup.vue'

const store = useStore()
const {match, select, style: overlayStyle, ref: overlayRef} = useOverlay()
const active = ref(NaN)

// `overlayStyle` carries the caret position as bare numbers, the framework-free shape core
// computes. React's DOM layer appends `px` to a numeric `left`/`top`; Vue assigns the number
// to `style.left` verbatim, the CSSOM rejects the unitless length, and the `position: fixed`
// popup falls back to its static position at the host's left edge. The unit belongs to the
// binding, as in `BlockMenu.vue`.
const popupStyle = computed(() => ({left: `${overlayStyle.value.left}px`, top: `${overlayStyle.value.top}px`}))

const data = computed(() => match.value?.option.overlay?.data || [])
const filtered = computed(() => {
	const search = match.value?.value ?? ''
	return filterSuggestions(data.value as string[], search)
})

function handleKeyDown(event: KeyboardEvent) {
	const result = navigateSuggestions(event.key, active.value, filtered.value.length)
	switch (result.action) {
		case 'up':
		case 'down':
			event.preventDefault()
			active.value = result.index
			break
		case 'select':
			event.preventDefault()
			const suggestion = filtered.value[result.index]
			if (suggestion) {
				select({value: suggestion, meta: result.index.toString()})
			}
			break
	}
}

onMounted(() => {
	const container = store.host.container()
	if (container) container.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
	const container = store.host.container()
	if (container) container.removeEventListener('keydown', handleKeyDown)
})

function handleItemClick(suggestion: string, index: number) {
	select({value: suggestion, meta: index.toString()})
}

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
				@click="handleItemClick(suggestion, index)"
			>
				{{ suggestion }}
			</ListItem>
		</List>
	</Popup>
</template>
