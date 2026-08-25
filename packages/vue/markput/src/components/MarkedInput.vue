<script setup lang="ts" generic="TMarkProps = MarkProps, TOverlayProps extends CoreOption['overlay'] = OverlayProps">
import {type CoreOption, type CoreSlots, Store} from '@markput/core'
import {markRaw, provide, toRaw, watch} from 'vue'

import {STORE_KEY} from '../lib/providers/storeKey'
import type {MarkedInputProps, MarkProps, OverlayProps} from '../types'
import Container from './Container.vue'
import OverlayRenderer from './OverlayRenderer.vue'

const props = defineProps<MarkedInputProps<TMarkProps, TOverlayProps>>()

const emit = defineEmits<{
	change: [value: string]
}>()

const store = new Store()

provide(STORE_KEY, store)

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

	store.props.set({
		value: props.value,
		defaultValue: props.defaultValue,
		onChange: (v: string) => emit('change', v),
		readOnly: props.readOnly,
		separator: props.separator,
		indent: props.indent,
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
		props.separator,
		props.indent,
		props.draggable,
	],
	syncProps
)

defineExpose(store.handle)
</script>

<template>
	<Container />
	<OverlayRenderer />
</template>
