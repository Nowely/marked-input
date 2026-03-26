<script setup lang="ts">
import type {Token as TokenType} from '@markput/core'

import {useStore} from '../lib/hooks/useStore'

import styles from '@markput/core/styles.module.css'

const props = defineProps<{token: TokenType}>()

const store = useStore()
const blockStore = store.blocks.get(props.token)
const menuOpen = blockStore.state.menuOpen.use()
const menuPosition = blockStore.state.menuPosition.use()
</script>

<template>
	<div
		v-if="menuOpen"
		:ref="el => blockStore.attachMenu(el as HTMLElement | null)"
		:class="styles.BlockMenu"
		:style="{top: menuPosition.top + 'px', left: menuPosition.left + 'px'}"
	>
		<div :class="styles.BlockMenuItem" @mousedown.prevent="blockStore.addBlock()">
			<span :class="[styles.Icon, styles.IconAdd]" />
			<span>Add below</span>
		</div>
		<div :class="styles.BlockMenuItem" @mousedown.prevent="blockStore.duplicateBlock()">
			<span :class="[styles.Icon, styles.IconDuplicate]" />
			<span>Duplicate</span>
		</div>
		<div :class="styles.BlockMenuSeparator" />
		<div :class="[styles.BlockMenuItem, styles.BlockMenuItemDelete]" @mousedown.prevent="blockStore.deleteBlock()">
			<span :class="[styles.Icon, styles.IconTrash]" />
			<span>Delete</span>
		</div>
	</div>
</template>
