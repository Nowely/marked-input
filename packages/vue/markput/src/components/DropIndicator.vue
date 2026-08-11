<script setup lang="ts">
import type {TreeNode} from '@markput/core'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'

import styles from '@markput/core/styles.module.css'

const props = defineProps<{node: TreeNode; position: 'before' | 'after'}>()

const store = useStore()
const blockStore = store.block.get(props.node)
const dropPosition = useMarkput(() => blockStore.state.dropPosition)

const dropControlRef = store.tokens.control()

const setDropRef = (el: unknown) => {
	dropControlRef(el as HTMLElement | null)
}
</script>

<template>
	<div
		v-if="dropPosition === position"
		:ref="setDropRef"
		:class="styles.DropIndicator"
		:style="position === 'before' ? {top: '-1px'} : {bottom: '-1px'}"
	/>
</template>
