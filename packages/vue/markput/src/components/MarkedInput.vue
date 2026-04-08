<script setup lang="ts">
import type {CoreSlotProps, CoreSlots, MarkputHandler, StyleProperties} from '@markput/core'
import {cx, DEFAULT_OPTIONS, merge, startBatch, endBatch, Store} from '@markput/core'
import {markRaw, provide, shallowRef, watch} from 'vue'

// oxlint-disable-next-line no-unassigned-import -- side-effect import: registers the Vue useHook factory via setUseHookFactory
import '../lib/hooks/createUseHook'
import {useCoreFeatures} from '../lib/hooks/useCoreFeatures'
import {STORE_KEY} from '../lib/providers/storeKey'
import type {MarkedInputProps} from '../types'
import Container from './Container.vue'
import OverlayRenderer from './OverlayRenderer.vue'
import Span from './Span.vue'

import styles from '@markput/core/styles.module.css'

const props = withDefaults(defineProps<MarkedInputProps>(), {
	options: () => DEFAULT_OPTIONS,
	showOverlayOn: 'change',
	readOnly: false,
	drag: false,
})

const emit = defineEmits<{
	change: [value: string]
}>()

const store = shallowRef(new Store({defaultSpan: markRaw(Span)}))

provide(STORE_KEY, store.value)

function syncProps() {
	const className = cx(styles.Container, props.className, props.slotProps?.container?.className as string | undefined)
	const style = merge(
		props.style as StyleProperties | undefined,
		props.slotProps?.container?.style as StyleProperties | undefined
	)

	const s = store.value.state
	startBatch()
	s.value(props.value)
	s.defaultValue(props.defaultValue)
	s.onChange((v: string) => emit('change', v))
	s.readOnly(props.readOnly)
	s.drag(props.drag)
	s.options(props.options)
	s.showOverlayOn(props.showOverlayOn)
	s.Span(props.Span)
	s.Mark(props.Mark)
	s.Overlay(props.Overlay)
	s.className(className)
	s.style(style as StyleProperties)
	s.slots(props.slots as CoreSlots)
	s.slotProps(props.slotProps as CoreSlotProps)
	endBatch()
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
	<Container />
	<OverlayRenderer />
</template>
