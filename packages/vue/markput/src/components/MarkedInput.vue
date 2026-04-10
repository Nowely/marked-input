<script setup lang="ts">
import {Store} from '@markput/core'
import {provide, shallowRef, watch} from 'vue'

// oxlint-disable-next-line no-unassigned-import -- side-effect import: registers the Vue useHook factory via setUseHookFactory
import '../lib/hooks/createUseHook'
import {useCoreFeatures} from '../lib/hooks/useCoreFeatures'
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
	store.value.setState({
		value: props.value,
		defaultValue: props.defaultValue,
		onChange: (v: string) => emit('change', v),
		readOnly: props.readOnly,
		drag: props.drag,
		options: props.options,
		showOverlayOn: props.showOverlayOn,
		Span: props.Span,
		Mark: props.Mark,
		Overlay: props.Overlay,
		className: props.class,
		style: props.style,
		slots: props.slots,
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
		props.drag,
	],
	syncProps
)

useCoreFeatures(store.value)

defineExpose(store.value.handler)
</script>

<template>
	<Container />
	<OverlayRenderer />
</template>
