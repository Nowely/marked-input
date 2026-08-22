<script setup lang="ts">
import type {CSSProperties, TreeNode} from '@markput/core'
import {renderSubscription} from '@markput/core'
import {computed} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import {unwrapEl} from '../lib/unwrapEl'
import BlockMenu from './BlockMenu.vue'
import DragHandle from './DragHandle.vue'
import DropIndicator from './DropIndicator.vue'
import Token from './Token.vue'

import styles from '@markput/core/styles.module.css'

const props = defineProps<{node: TreeNode}>()

const store = useStore()
const blockStore = store.block.get(props.node)

const blockComponent = useMarkput(s => s.slots.blockComponent)
const slotProps = useMarkput(s => s.slots.blockProps)
const isDragging = useMarkput(() => blockStore.state.isDragging)

const blockStyle = computed(() => ({
	opacity: isDragging.value ? 0.4 : 1,
	...(slotProps.value?.style as CSSProperties | undefined),
}))

// Strip style and className before v-bind to avoid double-application
const otherSlotProps = computed(() => {
	if (!slotProps.value) return undefined
	const {style: _s, className: _c, ...rest} = slotProps.value
	return Object.keys(rest).length > 0 ? rest : undefined
})

// Created ONCE in setup: `consign` and `children` mint a registration key per call, so calling
// them inside the ref callback would file a fresh entry on every paint and never release the old
// one. The wrapper IS the row's token element (issue 08) — no separate row registry entry — and
// it is ALSO the row's child-sequence host, because the row's children are painted straight into
// it. One element, two registrations: `bindingsFor` accepts it (`contains` is reflexive) and the
// row keeps its bare `contenteditable`.
const consignBlock = store.tokens.consign(props.node.id)
const hostBlock = store.tokens.children(props.node.id)

const setBlockRef = (el: unknown) => {
	const element = unwrapEl(el)
	consignBlock(element)
	hostBlock(element)
	blockStore.attachContainer(element)
}

// The per-row subscription: a RowNode's children are what this component paints, so a
// structural edit inside the row must re-render it — `renderSubscription`'s row arm,
// the same job its mark arm does for Token.
const rendered = useMarkput(() => renderSubscription(props.node))
// READ so the computed depends on it — core's `children` signal is not Vue-reactive, so the
// subscription ref is what carries the change across. The kind check stays here because the
// template forks on it: a row paints its children, anything else falls back to one Token.
const rowChildren = computed(() => {
	void rendered.value
	return props.node.kind === 'row' ? props.node.children() : undefined
})
</script>

<template>
	<component
		:is="blockComponent"
		:ref="setBlockRef"
		v-bind="otherSlotProps"
		:class="[styles.Block, slotProps?.className as string | undefined]"
		:style="blockStyle"
	>
		<DropIndicator :node="node" position="before" />
		<DragHandle :node="node" />
		<template v-if="rowChildren">
			<Token v-for="child in rowChildren" :key="child.id" :node="child" :depth="0" />
		</template>
		<Token v-else :node="node" :depth="0" />
		<DropIndicator :node="node" position="after" />
		<BlockMenu :node="node" />
	</component>
</template>
