<script setup lang="ts">
import {KEYBOARD} from '@markput/core'
import {ref, computed, onMounted, onUnmounted} from 'vue'

import {useOverlay} from '../../lib/hooks/useOverlay'
import {useStore} from '../../lib/hooks/useStore'

import styles from '@markput/core/styles.module.css'

const store = useStore()
const {match, select, style: overlayStyle, ref: overlayRef} = useOverlay()
const active = ref(NaN)

const data = computed(() => match.value?.option.overlay?.data || [])
const filtered = computed(() => {
	const search = match.value?.value.toLowerCase() ?? ''
	return (data.value as string[]).filter(s => s.toLowerCase().indexOf(search) > -1)
})

function handleKeyDown(event: KeyboardEvent) {
	const length = filtered.value.length
	switch (event.key) {
		case KEYBOARD.UP:
			event.preventDefault()
			active.value = isNaN(active.value) ? 0 : (length + ((active.value - 1) % length)) % length
			break
		case KEYBOARD.DOWN:
			event.preventDefault()
			active.value = isNaN(active.value) ? 0 : (active.value + 1) % length
			break
		case KEYBOARD.ENTER:
			event.preventDefault()
			if (!isNaN(active.value)) {
				const suggestion = filtered.value[active.value]
				if (suggestion) {
					select({value: suggestion, meta: active.value.toString()})
				}
			}
			break
	}
}

onMounted(() => {
	const container = store.refs.container
	if (container) {
		container.addEventListener('keydown', handleKeyDown)
	}
})

onUnmounted(() => {
	const container = store.refs.container
	if (container) {
		container.removeEventListener('keydown', handleKeyDown)
	}
})

function handleItemClick(suggestion: string, index: number) {
	select({value: suggestion, meta: index.toString()})
}

function setOverlayRef(el: any) {
	overlayRef.current = el
}

function scrollActiveIntoView(el: HTMLElement | null, index: number) {
	if (index === active.value && el) {
		el.scrollIntoView(false)
	}
}
</script>

<template>
	<ul v-if="filtered.length" :ref="setOverlayRef" :class="styles.Suggestions" :style="overlayStyle">
		<li
			v-for="(suggestion, index) in filtered"
			:key="suggestion"
			:ref="el => scrollActiveIntoView(el as HTMLElement, index)"
			:class="index === active ? styles.suggestionActive : undefined"
			@click="handleItemClick(suggestion, index)"
		>
			{{ suggestion }}
		</li>
	</ul>
</template>
