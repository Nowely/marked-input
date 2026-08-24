<script setup lang="ts">
import {useOverlay} from '@markput/vue'
import {computed, onMounted, onUnmounted, ref, watch, type ComponentPublicInstance} from 'vue'

import {MENTIONS, TAGS} from './content'

// OverlayRenderer passes the option's trigger as attrs; without this it spills onto the root div.
defineOptions({inheritAttrs: false})

type Item = {label: string; hint?: string; avatar?: string; value: string; meta?: string}

const {select, close, match: matchRef, style, ref: overlayRef} = useOverlay()
const active = ref(0)

const query = computed(() => (matchRef.value?.value ?? '').toLowerCase())
const trigger = computed(() => matchRef.value?.option.overlay?.trigger)

const items = computed<Item[]>(() => {
	if (trigger.value === '@') {
		return MENTIONS.filter(m => m.name.toLowerCase().includes(query.value)).map(m => ({
			label: m.name,
			hint: `@${m.handle}`,
			avatar: m.name[0],
			value: m.name,
			meta: m.handle,
		}))
	}
	return TAGS.filter(t => t.includes(query.value)).map(t => ({label: `#${t}`, value: t}))
})

watch([trigger, query], () => (active.value = 0))

// The hook's style is unitless numbers; position: fixed needs the px suffix.
const position = computed(() => ({
	left: `${Math.min(style.value.left, window.innerWidth - 248)}px`,
	top: `${style.value.top}px`,
}))

function setOverlayRef(el: Element | ComponentPublicInstance | null) {
	overlayRef.current = el instanceof HTMLElement ? el : null
}

function pick(item: Item) {
	select({value: item.value, meta: item.meta})
}

// Custom overlays get no keyboard navigation from core; capture phase beats the contenteditable.
function onKeyDown(event: KeyboardEvent) {
	const list = items.value
	if (list.length === 0) return
	if (event.key === 'ArrowDown') active.value = (active.value + 1) % list.length
	else if (event.key === 'ArrowUp') active.value = (active.value - 1 + list.length) % list.length
	else if (event.key === 'Enter') pick(list[active.value])
	else if (event.key === 'Escape') close()
	else return
	event.preventDefault()
	event.stopPropagation()
}

onMounted(() => document.addEventListener('keydown', onKeyDown, true))
onUnmounted(() => document.removeEventListener('keydown', onKeyDown, true))
</script>

<template>
	<div v-if="items.length > 0" class="overlay" :ref="setOverlayRef" :style="position">
		<button
			v-for="(item, index) in items"
			:class="['overlay-item', {active: index === active}]"
			:key="item.value"
			tabindex="-1"
			type="button"
			@click="pick(item)"
			@mouseenter="active = index"
		>
			<span v-if="item.avatar" class="overlay-avatar">{{ item.avatar }}</span>
			{{ item.label }}
			<span v-if="item.hint" class="overlay-hint">{{ item.hint }}</span>
		</button>
	</div>
</template>
