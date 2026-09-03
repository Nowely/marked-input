<script setup lang="ts" generic="TMarkProps = MarkProps, TOverlayProps extends CoreOption['overlay'] = OverlayProps">
import {type CoreOption, type CoreSlots, Store} from '@markput/core'
import {computed, markRaw, provide, toRaw, watch} from 'vue'

import {STORE_KEY} from '../lib/providers/storeKey'
import type {MarkedInputProps, MarkProps, OverlayProps} from '../types'
import Container from './Container.vue'
import OverlayRenderer from './OverlayRenderer.vue'

// `history` is DECLARED with an undefined default, and it is the only prop that needs to be:
// Vue casts an absent Boolean-typed prop to `false` unless the declaration carries a default, so
// a prop the caller omitted would arrive as `false` and turn the feature off. It is the first
// boolean prop whose core default is `true` — `readOnly` and `draggable` default to `false`, so
// the cast has agreed with them by coincidence.
const props = withDefaults(defineProps<MarkedInputProps<TMarkProps, TOverlayProps>>(), {history: undefined})

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

// DERIVED ONCE PER CHANGE, not once per sync, and that is a cost rather than a tidiness. This is
// read by `slots.node`, ONE computed that every row subscribes to; rebuilt inline it arrived with
// fresh OPTION OBJECTS on every sync, so `slots.node` recomputed, its 4000 watchers woke, and EVERY
// row repainted for an edit in one of them — the whole of why Vue's cost barely depended on where
// the caret was (issue 47).
//
// `props.options` carries an element-wise equality gate, so a caller's fresh ARRAY of unchanged
// options is already absorbed; what defeats it is minting new elements, which is exactly what the
// `markRaw` map does. The slots object needs no twin of this: `props.slots` gained the same gate,
// which absorbs a fresh object with unchanged components — measured, and the sibling half of this
// fix until then.
const rawOptions = computed(() =>
	props.options?.map(opt => ({
		...opt,
		Mark: opt.Mark ? markRaw(toRaw(opt.Mark)) : undefined,
		Overlay: opt.Overlay ? markRaw(toRaw(opt.Overlay)) : undefined,
	}))
)

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
		history: props.history,
		draggable: props.draggable,
		options: rawOptions.value,
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
		props.history,
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
