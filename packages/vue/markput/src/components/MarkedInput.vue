<script setup lang="ts">
import {type CoreSlots, Store} from '@markput/core'
import {onMounted, onUnmounted, provide, shallowRef, watch} from 'vue'

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

function syncProps() {
	store.value.setProps({
		value: props.value,
		defaultValue: props.defaultValue,
		onChange: (v: string) => emit('change', v),
		readOnly: props.readOnly,
		layout: props.layout,
		draggable: props.draggable,
		options: props.options,
		showOverlayOn: props.showOverlayOn,
		Span: props.Span,
		Mark: props.Mark,
		Overlay: props.Overlay,
		className: props.class,
		style: props.style,
		slots: props.slots as CoreSlots | undefined,
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
	store.value.emit.mounted()
})
onUnmounted(() => store.value.emit.unmounted())

defineExpose(store.value.handler)
</script>

<template>
	<Container />
	<OverlayRenderer />
</template>
