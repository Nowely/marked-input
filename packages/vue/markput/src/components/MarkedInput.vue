<script setup lang="ts">
import type {CoreSlotProps, CoreSlots, MarkputHandler, StyleProperties} from '@markput/core'
import {cx, DEFAULT_OPTIONS, merge, Store} from '@markput/core'
import {computed, provide, shallowRef, watch} from 'vue'

import {createUseHook} from '../lib/hooks/createUseHook'
import {useCoreFeatures} from '../lib/hooks/useCoreFeatures'
import {STORE_KEY} from '../lib/providers/storeKey'
import type {MarkedInputProps} from '../types'
import Container from './Container.vue'
import DragContainer from './DragContainer.vue'
import OverlayRenderer from './OverlayRenderer.vue'

import styles from '@markput/core/styles.module.css'

const props = withDefaults(defineProps<MarkedInputProps>(), {
	options: () => DEFAULT_OPTIONS,
	showOverlayOn: 'change',
	readOnly: false,
	drag: false,
})

const ContainerImpl = computed(() => (props.drag ? DragContainer : Container))

const emit = defineEmits<{
	change: [value: string]
}>()

const store = shallowRef(new Store({createUseHook}))

provide(STORE_KEY, store.value)

function syncProps() {
	const className = cx(styles.Container, props.className, props.slotProps?.container?.className as string | undefined)
	const style = merge(
		props.style as StyleProperties | undefined,
		props.slotProps?.container?.style as StyleProperties | undefined
	)

	store.value.state.set({
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
		className,
		style: style as StyleProperties,
		slots: props.slots as CoreSlots,
		slotProps: props.slotProps as CoreSlotProps,
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
		props.className,
		props.style,
		props.slots,
		props.slotProps,
		props.drag,
	],
	syncProps
)

useCoreFeatures(store.value)

const handler: MarkputHandler = store.value.createHandler()
defineExpose(handler)
</script>

<template>
	<component :is="ContainerImpl" />
	<OverlayRenderer />
</template>
