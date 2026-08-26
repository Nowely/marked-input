<script setup lang="ts">
import type {CSSProperties, RowNode} from '@markput/core'
import {renderSubscription} from '@markput/core'
import {computed} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import {unwrapEl} from '../lib/unwrapEl'
// oxlint-disable-next-line import/no-cycle -- A recursive component pair: `Rows` maps a sibling list and `Block` paints one row and its own list. The cycle is the recursion, and both sides are used only inside a render body.
import Rows from './Rows.vue'
import Token from './Token.vue'

/**
 * A row, painted by its KIND's component — a paragraph falls back to `slots.paragraph`. The grip,
 * the drop indicators and the menu that used to be painted here live in the editor's one
 * `RowControls`.
 *
 * The component and its props come from `slots.node`, the same resolver `Token` asks: a row is a
 * node, and the class/style merge that used to sit here by hand is the resolver's answer now.
 *
 * A row's CHILD ROWS reach a kind's component through its `rows` SLOT, so it decides where they
 * go — a toggle hides them, a bullet nests a list inside its `<li>`. A PARAGRAPH gets none: its
 * component is `slots.paragraph`, whose default is a bare `div`, so its child rows go in as ordinary
 * children after the inline ones.
 */
const props = defineProps<{node: RowNode; depth: number; index: number}>()

const store = useStore()

const resolveNodeSlot = useMarkput(s => s.slots.node)
// A SCALAR subscription: read as a boolean, the derivation notifies only when THIS row's own
// answer flips, so picking a row up does not re-render every other row.
const isDragging = useMarkput(s => () => s.rows.state.dragging() === props.node.id)

// Created ONCE in setup: `consign` and `children` mint a registration key per call, so calling
// them inside the ref callback would file a fresh entry on every paint and never release the old
// one. The wrapper IS the row's token element (issue 08) AND its INLINE child-sequence host, so
// the row's own content hangs off it directly.
const consignBlock = store.tokens.consign(props.node.id)
const hostBlock = store.tokens.children(props.node.id)
const hostRows = store.tokens.children(props.node.id, 'rows')

const setBlockRef = (el: unknown) => {
	const element = unwrapEl(el)
	consignBlock(element)
	hostBlock(element)
}

const setRowsRef = (el: unknown) => hostRows(unwrapEl(el))

// The per-row subscription: a row's kind, its meta and its children are what this component
// paints, so an edit to any of them must re-render it — `renderSubscription`'s row arm, the same
// job its mark arm does for Token.
const rendered = useMarkput(() => renderSubscription(props.node))

// READ so the computeds depend on it — core's signals are not Vue-reactive, so the subscription
// ref is what carries the change across.
const resolved = computed(() => {
	void rendered.value
	// No `rows` in the render context: Vue hands the child rows over as a SLOT, so the framework
	// node itself never travels through core. What core decides is where the row's own data may
	// go at all.
	return resolveNodeSlot.value(props.node, {depth: props.depth, index: props.index})
})
const inlineChildren = computed(() => {
	void rendered.value
	return props.node.inline()
})
const childRows = computed(() => {
	void rendered.value
	return props.node.rows()
})
/** `node` in the resolved props is core's answer for "this row paints through its KIND's own component". */
const isKind = computed(() => 'node' in resolved.value[1])
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
		<template #default>
			<Token v-for="child in inlineChildren" :key="child.id" :node="child" :depth="0" />
			<!-- HIDDEN rather than absent is the consumer's contract for a collapsed row: an
			     unpainted row leaves `bind` and takes its anchors with it. What is absent here is
			     the HOST, and only when the row genuinely has no children. -->
			<span v-if="!isKind && childRows.length > 0" :ref="setRowsRef" style="display: contents">
				<Rows :rows="childRows" :depth="depth + 1" />
			</span>
		</template>
		<template v-if="isKind && childRows.length > 0" #rows>
			<span :ref="setRowsRef" style="display: contents">
				<Rows :rows="childRows" :depth="depth + 1" />
			</span>
		</template>
	</component>
</template>
