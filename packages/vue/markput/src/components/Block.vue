<script setup lang="ts">
import type {Token as TokenType} from '@markput/core'

import {useStore} from '../lib/hooks/useStore'
import BlockMenu from './BlockMenu.vue'
import DragHandle from './DragHandle.vue'
import DropIndicator from './DropIndicator.vue'
import Token from './Token.vue'

import styles from '@markput/core/styles.module.css'

const props = defineProps<{token: TokenType; blockIndex: number}>()

const store = useStore()
const blockStore = store.blocks.get(props.token)
const isDragging = blockStore.state.isDragging.use()
</script>

<template>
	<div
		:ref="el => blockStore.attachContainer(el as HTMLElement | null, props.blockIndex, store.events)"
		v-bind="{'data-testid': 'block'}"
		:class="styles.Block"
		:style="{opacity: isDragging ? 0.4 : 1}"
	>
		<DropIndicator :token="token" position="before" />
		<DragHandle :token="token" :block-index="blockIndex" />
		<Token :mark="token" />
		<DropIndicator :token="token" position="after" />
		<BlockMenu :token="token" />
	</div>
</template>
