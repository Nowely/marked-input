<script setup lang="ts">
import {computed} from 'vue'
import type {Ref} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import {unwrapEl} from '../lib/unwrapEl'
import RowControls from './RowControls.vue'
import Rows from './Rows.vue'
import Token from './Token.vue'

const store = useStore()
const result = useMarkput(s => ({
	rowConfig: s.tokens.rowConfig,
	nodes: s.tokens.nodes,
}))

const containerComponent = useMarkput(s => s.slots.containerComponent)
const containerProps = useMarkput(s => s.slots.containerProps)

// Compose the host ref with a user-provided slotProps.container ref: the model
// publishes tokens only once the container mounts, so letting a user ref shadow
// the host ref would leave the editor permanently empty. We strip the user's
// `ref` from the spread so it isn't forwarded onto the element (Vue 3 does NOT
// treat `ref` inside a v-bind object as a template ref, but we still exclude it
// to avoid passing a function/Ref as a DOM attribute); the host's
// `:ref="setContainerRef"` is then the sole template ref and must fire or the
// model never publishes tokens.
type UserRef = ((el: HTMLElement | null) => void) | Ref<HTMLElement | null>

const containerSlot = computed(() => containerProps.value as {ref?: UserRef} & Record<string, unknown>)
const userRef = computed<UserRef | undefined>(() => containerSlot.value.ref)
const boundProps = computed(() => {
	const {ref: _ref, ...rest} = containerSlot.value
	return rest
})

/** The roots as ROWS, which they all are when a separator is configured. */
const rowRoots = computed(() => result.value.nodes.filter(node => node.kind === 'row'))

const setContainerRef = (el: unknown) => {
	const element = unwrapEl(el)
	store.host.container(element)

	const user = userRef.value
	if (typeof user === 'function') user(element)
	else if (user) user.value = element
}
</script>

<template>
	<component :is="containerComponent" :ref="setContainerRef" v-bind="boundProps">
		<!-- Branched on the PROPS-derived separator rather than per node: Vue gives a per-item
		     `v-if` its own Fragment, and a Fragment mounts two empty text anchors, so the
		     per-node form would push 2N stray text nodes into the editing host. The branch is
		     equivalent — a configured separator is exactly when the parse yields rows.
		     The roots are then ONE sibling list of rows, painted by the same component a row's
		     own children are, so the depth index has one implementation at every depth. -->
		<template v-if="result.rowConfig !== undefined">
			<Rows :rows="rowRoots" :depth="0" />
			<!-- The row controls, as one layer INSIDE the container rather than a copy inside
			     every row. It is therefore a container child that is not a row —
			     `styles.RowControls` is how a caller tells them apart. -->
			<RowControls />
		</template>
		<template v-else>
			<Token v-for="node in result.nodes" :key="node.id" :node="node" :depth="0" />
		</template>
	</component>
</template>
