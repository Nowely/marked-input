<script setup lang="ts">
import type {RowNode} from '@markput/core'

// oxlint-disable-next-line import/no-cycle -- A recursive component pair: `Rows` maps a sibling list and `Row` paints one row and its own list. The cycle is the recursion, and both sides are used only inside a render body.
import Row from './Row.vue'

/**
 * ONE sibling list of rows, at any depth: the container's roots and a row's own children paint
 * through the same component, because they are the same list.
 *
 * A bare `v-for` on the component, NOT a `<template v-for>`: rejection D9 measured that each
 * `<template v-for>` item gets its own Fragment and a Fragment mounts two empty text anchors,
 * pushing 2N stray text nodes into the editing host.
 */
defineProps<{rows: readonly RowNode[]; depth: number}>()
</script>

<template>
	<Row v-for="(row, index) in rows" :key="row.id" :node="row" :depth="depth" :index="index" />
</template>
