<script setup lang="ts">
import type {CSSProperties, RowNode} from '@markput/core'
import {cx, renderSubscription} from '@markput/core'
import {computed, watch} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import {unwrapEl} from '../lib/unwrapEl'
// oxlint-disable-next-line import/no-cycle -- A recursive component pair: `Rows` maps a sibling list and `Row` paints one row and its own list. The cycle is the recursion, and both sides are used only inside a render body.
import Rows from './Rows.vue'
import Token from './Token.vue'

import styles from '@markput/core/styles.module.css'

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
const props = defineProps<{node: RowNode; depth: number}>()

const store = useStore()

const resolveNodeSlot = useMarkput(s => s.slots.node)
// A SCALAR subscription: read as a boolean, the derivation notifies only when THIS row's own
// answer flips, so picking a row up does not re-render every other row.
const isDragging = useMarkput(s => () => s.rows.state.dragging() === props.node.id)
// THE ROW SELECTION, and a SCALAR for the same reason: `rows.selected()` is one editor-level
// signal, so reading the array here would re-render every row on every selection change. The paint
// is the editor's because the platform's own highlight is not legible over a kind that draws its
// own backgrounds — see `.RowSelected` in `styles.module.css`.
const isSelected = useMarkput(s => () => s.rows.selected().includes(props.node.id))

// Created ONCE in setup: `consign` and `children` mint a registration key per call, so calling
// them inside the ref callback would file a fresh entry on every paint and never release the old
// one. The wrapper IS the row's token element (issue 08) AND its INLINE child-sequence host, so
// the row's own content hangs off it directly.
const consignRow = store.tokens.consign(props.node.id)
const hostRow = store.tokens.children(props.node.id)
const hostRows = store.tokens.children(props.node.id, 'rows')

const setRowRef = (el: unknown) => {
	const element = unwrapEl(el)
	consignRow(element)
	hostRow(element)
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
	return resolveNodeSlot.value(props.node, {depth: props.depth})
})
// Vue sets template refs before it runs post-flush callbacks, so by here `setRowRef` has fired for
// every kind that let the editor's `ref` reach an element. Core reports the ones that did not; see
// `rowPainted`.
//
// A WATCHER RATHER THAN `onMounted`, because a TURN-INTO keeps this row's node and swaps the kind
// under it, so nothing remounts and mount alone never asked again — the slash menu, which is how a
// consumer meets their own new kind first, was the one path this said nothing about. `onCleanup`
// carries core's cancel for both cases the mount hook could not: the previous kind's pending
// verdict, and a row that leaves the document before its frame.
watch(
	() => resolved.value[0],
	(_kind, _previous, onCleanup) => onCleanup(store.tokens.rowPainted(props.node)),
	{
		immediate: true,
		flush: 'post',
	}
)

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
const rowStyle = computed(() => ({
	opacity: isDragging.value ? 0.4 : 1,
	...(resolved.value[1].style as CSSProperties | undefined),
}))
const rowProps = computed(() => {
	const {style: _s, className, ...rest} = resolved.value[1]
	// `class`, which is Vue's own spelling and the one `RowProps` publishes. Handed over as
	// `className` — the resolver's key, and React's prop name — it reached the element as a DOM
	// PROPERTY write, so a kind whose template carried any class of its own had it silently
	// overwritten: measured, `<div class="mine">` painted `class="_Row_…"` and nothing else. As
	// `class` it is a fallthrough attribute, which Vue MERGES, so a kind adds its classes by
	// writing them and needs no plumbing at all.
	//
	// The selection class rides the same merge the drag opacity does — the resolver owns the
	// consumer/`styles.Row` merge, and this appends the editor's own paint to its answer.
	return {...rest, class: cx(className as string | undefined, isSelected.value && styles.RowSelected)}
})
</script>

<template>
	<component :is="resolved[0]" :ref="setRowRef" v-bind="rowProps" :style="rowStyle">
		<template #default>
			<Token v-for="child in inlineChildren" :key="child.id" :node="child" :depth="0" />
			<!-- HIDDEN rather than absent is the consumer's contract for a collapsed row: an
			     unpainted row leaves `bind` and takes its anchors with it.

			     THE HOST IS RENDERED WHETHER OR NOT THE ROW HAS CHILDREN, and that is the whole of
			     what `DomModel.nestingIsPainted` reads: a kind that never renders the `rows` slot
			     mounts no host, and core has to know that BEFORE it writes the first child into
			     such a row — a drop that nested a paragraph under a heading left it in the
			     document with no box at all. It costs one boxless `display: contents` element per
			     kind row. -->
			<span v-if="!isKind" :ref="setRowsRef" style="display: contents">
				<Rows :rows="childRows" :depth="depth + 1" />
			</span>
		</template>
		<template v-if="isKind" #rows>
			<span :ref="setRowsRef" style="display: contents">
				<Rows :rows="childRows" :depth="depth + 1" />
			</span>
		</template>
	</component>
</template>
