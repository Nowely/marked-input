<script setup lang="ts">
import {filterSuggestions, navigateSuggestions} from '@markput/core'
import {ref, computed, onMounted, onUnmounted, type ComponentPublicInstance} from 'vue'

import {useOverlay} from '../../lib/hooks/useOverlay'
import {useStore} from '../../lib/hooks/useStore'

import styles from '@markput/core/styles.module.css'

const store = useStore()
const {match, select, style: overlayStyle, ref: overlayRef} = useOverlay()
const active = ref(NaN)

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

function setOverlayRef(el: Element | ComponentPublicInstance | null) {
	overlayRef.current = el instanceof HTMLElement ? el : null
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
