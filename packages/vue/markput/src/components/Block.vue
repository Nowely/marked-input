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

const blockComponent = useMarkput(s => s.computed.blockComponent)
const slotProps = useMarkput(s => s.computed.blockProps)
const isDragging = useMarkput(() => blockStore.state.isDragging)

const blockStyle = computed(() => {
	const style: CSSProperties = {
		opacity: isDragging.value ? 0.4 : 1,
	}
	if (slotProps.value?.style) {
		Object.assign(style, slotProps.value.style)
	}
	return style
})
</script>

<template>
	<component
		:is="blockComponent"
		:ref="(el: any) => blockStore.attachContainer(el?.$el ?? el, props.blockIndex, store.event)"
		data-testid="block"
		v-bind="slotProps"
		:class="styles.Block"
		:style="blockStyle"
	>
		<DropIndicator :token="token" position="before" />
		<DragHandle :token="token" :block-index="blockIndex" />
		<Token :mark="token" />
		<DropIndicator :token="token" position="after" />
		<BlockMenu :token="token" />
	</component>
</template>
