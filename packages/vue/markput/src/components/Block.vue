<script setup lang="ts">
import type {CSSProperties, RowNode} from '@markput/core'
import {renderSubscription} from '@markput/core'
import {computed} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import {unwrapEl} from '../lib/unwrapEl'
import Token from './Token.vue'

/**
 * A row, painted by its KIND's component — a paragraph falls back to `slots.block`. The grip,
 * the drop indicators and the menu that used to be painted here live in the editor's one
 * `BlockControls`.
 *
 * The component and its props come from `slots.node`, the same resolver `Token` asks: a row is a
 * node, and the class/style merge that used to sit here by hand is the resolver's answer now.
 */
const props = defineProps<{node: RowNode}>()

const store = useStore()

const resolveNodeSlot = useMarkput(s => s.slots.node)
// A SCALAR subscription: read as a boolean, the derivation notifies only when THIS row's own
// answer flips, so picking a row up does not re-render every other row.
const isDragging = useMarkput(s => () => s.block.state.dragging() === props.node.id)

// Created ONCE in setup: `consign` and `children` mint a registration key per call, so calling
// them inside the ref callback would file a fresh entry on every paint and never release the old
// one. The wrapper IS the row's token element (issue 08) AND its child-sequence host, so the
// row's children hang off it directly.
const consignBlock = store.tokens.consign(props.node.id)
const hostBlock = store.tokens.children(props.node.id)

const setBlockRef = (el: unknown) => {
	const element = unwrapEl(el)
	consignBlock(element)
	hostBlock(element)
}

// The per-row subscription: a row's kind, its meta and its children are what this component
// paints, so an edit to any of them must re-render it — `renderSubscription`'s row arm, the same
// job its mark arm does for Token.
const rendered = useMarkput(() => renderSubscription(props.node))

// READ so the computeds depend on it — core's signals are not Vue-reactive, so the subscription
// ref is what carries the change across.
const resolved = computed(() => {
	void rendered.value
	return resolveNodeSlot.value(props.node)
})
const rowChildren = computed(() => {
	void rendered.value
	return props.node.children()
})
const blockStyle = computed(() => ({
	opacity: isDragging.value ? 0.4 : 1,
	...(resolved.value[1].style as CSSProperties | undefined),
}))
const blockProps = computed(() => {
	const {style: _s, ...rest} = resolved.value[1]
	return rest
})
</script>

<template>
	<component :is="resolved[0]" :ref="setBlockRef" v-bind="blockProps" :style="blockStyle">
		<Token v-for="child in rowChildren" :key="child.id" :node="child" :depth="0" />
	</component>
</template>
