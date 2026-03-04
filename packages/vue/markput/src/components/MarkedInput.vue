<script setup lang="ts">
import {computed, provide, shallowRef, watch} from 'vue'
import type {CoreSlotProps, CoreSlots, MarkputHandler, StyleProperties} from '@markput/core'
import {cx, merge, Store} from '@markput/core'
import styles from '@markput/core/styles.module.css'
import type {MarkedInputProps} from '../types'
import {DEFAULT_OPTIONS} from '../constants'
import {createUseHook} from '../lib/hooks/createUseHook'
import {useCoreFeatures} from '../lib/hooks/useCoreFeatures'
import {STORE_KEY} from '../lib/providers/storeKey'
import Container from './Container.vue'
import BlockContainer from './BlockContainer.vue'
import OverlayRenderer from './OverlayRenderer.vue'

const props = withDefaults(defineProps<MarkedInputProps>(), {
	options: () => DEFAULT_OPTIONS,
	showOverlayOn: 'change',
	readOnly: false,
	block: false,
})

const ContainerImpl = computed(() => (props.block ? BlockContainer : Container))

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
		options: props.options,
		showOverlayOn: props.showOverlayOn,
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
		props.Mark,
		props.Overlay,
		props.className,
		props.style,
		props.slots,
		props.slotProps,
		props.block,
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
