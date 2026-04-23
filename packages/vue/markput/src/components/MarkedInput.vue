<script setup lang="ts">
import {type CoreSlots, Store} from '@markput/core'
import {markRaw, onMounted, onUnmounted, provide, shallowRef, toRaw, watch} from 'vue'

import {STORE_KEY} from '../lib/providers/storeKey'
import type {MarkedInputProps} from '../types'
import Container from './Container.vue'
import OverlayRenderer from './OverlayRenderer.vue'

const props = defineProps<MarkedInputProps>()

const emit = defineEmits<{
	change: [value: string]
}>()

const store = shallowRef(new Store())

provide(STORE_KEY, store.value)

function markSlotComponents(slots: CoreSlots | undefined): CoreSlots | undefined {
	if (!slots) return undefined
	const result: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(slots)) {
		const raw = toRaw(value as object)
		result[key] = raw && typeof raw === 'object' && 'setup' in raw ? markRaw(raw) : value
	}
	return result as CoreSlots
}

function syncProps() {
	const rawMark = props.Mark ? markRaw(toRaw(props.Mark)) : undefined
	const rawSpan = props.Span ? markRaw(toRaw(props.Span)) : undefined
	const rawOverlay = props.Overlay ? markRaw(toRaw(props.Overlay)) : undefined

	store.value.props.set({
		value: props.value,
		defaultValue: props.defaultValue,
		onChange: (v: string) => emit('change', v),
		readOnly: props.readOnly,
		layout: props.layout,
		draggable: props.draggable,
		options: props.options?.map(opt => ({
			...opt,
			Mark: opt.Mark ? markRaw(toRaw(opt.Mark)) : undefined,
			Overlay: opt.Overlay ? markRaw(toRaw(opt.Overlay)) : undefined,
		})),
		showOverlayOn: props.showOverlayOn,
		Span: rawSpan,
		Mark: rawMark,
		Overlay: rawOverlay,
		className: props.class,
		style: props.style,
		slots: markSlotComponents(props.slots as CoreSlots | undefined),
		slotProps: props.slotProps,
	})
}

syncProps()

watch(
	() => [
		props.value,
		props.defaultValue,
		props.readOnly,
		props.options,
		props.showOverlayOn,
		props.Span,
		props.Mark,
		props.Overlay,
		props.class,
		props.style,
		props.slots,
		props.slotProps,
		props.layout,
		props.draggable,
	],
	syncProps
)

onMounted(() => {
	store.value.feature.lifecycle.emit.mounted()
})
onUnmounted(() => store.value.feature.lifecycle.emit.unmounted())

defineExpose(store.value.handler)
</script>

<template>
	<Container />
	<OverlayRenderer />
</template>
