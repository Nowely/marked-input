<script setup lang="ts">
import type {RowNode} from '@markput/core'
import {computed} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
// oxlint-disable-next-line import/no-cycle -- A recursive component pair: `Rows` maps a sibling list and `Block` paints one row and its own list. The cycle is the recursion, both sides are used only inside a render body, and the alternative is the grouping rule written twice.
import Block from './Block.vue'

/**
 * ONE sibling list of rows, at any depth: the container's roots and a row's own children paint
 * through the same component, because they are the same list.
 *
 * The GROUP runs come from core (`slots.rowGroups`) rather than from a fold written here — a
 * wrapper around consecutive siblings is one rule, and writing it once per adapter is the defect
 * `9024586b` removed for suggestions. A list declaring no group at all is ONE run, so the
 * `<template v-for>` below costs one Fragment for the whole list rather than one per row.
 *
 * `index` is the row's position among ITS SIBLINGS, not within its run: a group is presentation
 * and does not renumber the list it wraps. It is resolved HERE rather than by `v-for`, whose
 * index would restart inside each run's own loop.
 */
const props = defineProps<{rows: readonly RowNode[]; depth: number}>()

const resolveRowGroups = useMarkput(s => s.slots.rowGroups)

// Keyed by the RUN's position, not by its first row's id: a run is presentation and has no
// identity of its own, and keying it by a member makes a reorder inside the run look like a new
// wrapper — which unmounts every row in it and rebuilds the elements a drag must move.
const groups = computed(() => {
	let index = 0
	return resolveRowGroups.value(props.rows).map((group, key) => ({
		Group: group.Group,
		key,
		entries: group.rows.map(row => ({row, index: index++})),
	}))
})
</script>

<template>
	<template v-for="group in groups" :key="group.key">
		<component :is="group.Group" v-if="group.Group">
			<Block v-for="e in group.entries" :key="e.row.id" :node="e.row" :depth="depth" :index="e.index" />
		</component>
		<template v-else>
			<Block v-for="e in group.entries" :key="e.row.id" :node="e.row" :depth="depth" :index="e.index" />
		</template>
	</template>
</template>
