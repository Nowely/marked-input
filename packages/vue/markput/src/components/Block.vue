<script setup lang="ts">
import type {CSSProperties, Token as TokenType} from '@markput/core'
import {computed} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import BlockMenu from './BlockMenu.vue'
import DragHandle from './DragHandle.vue'
import DropIndicator from './DropIndicator.vue'
import Token from './Token.vue'

import styles from '@markput/core/styles.module.css'

const props = defineProps<{token: TokenType; blockIndex: number}>()

const store = useStore()
const blockStore = store.blocks.get(props.token)

const index = useMarkput(s => s.parsing.index)
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

const setBlockRef = (el: unknown) => {
	const resolved = el as {$el?: HTMLElement} | HTMLElement | null
	const element = (resolved && '$el' in resolved ? resolved.$el : resolved) as HTMLElement | null
	blockStore.attachContainer(element, props.blockIndex, {action: store.drag.action})
	const path = index.value.pathFor(props.token)
	if (path) store.dom.refFor({role: 'row', path})(element)
}
</script>

<template>
	<component
		:is="blockComponent"
		:ref="setBlockRef"
		data-testid="block"
		v-bind="otherSlotProps"
		:class="[styles.Block, slotProps?.className as string | undefined]"
		:style="blockStyle"
	>
		<DropIndicator :token="token" position="before" />
		<DragHandle :token="token" :block-index="blockIndex" />
		<Token :token="token" />
		<DropIndicator :token="token" position="after" />
		<BlockMenu :token="token" />
	</component>
</template>
