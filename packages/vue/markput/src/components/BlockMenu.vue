<script setup lang="ts">
import type {Token as TokenType} from '@markput/core'

import {useStore} from '../lib/hooks/useStore'
import List from './Popup/List.vue'
import ListItem from './Popup/ListItem.vue'
import Popup from './Popup/Popup.vue'

import styles from '@markput/core/styles.module.css'

const props = defineProps<{token: TokenType}>()

const store = useStore()
const blockStore = store.blocks.get(props.token)
const menuOpen = blockStore.state.menuOpen.use()
const menuPosition = blockStore.state.menuPosition.use()
</script>

<template>
	<Popup
		v-if="menuOpen"
		:attach-ref="el => blockStore.attachMenu(el)"
		:style="{top: menuPosition.top + 'px', left: menuPosition.left + 'px'}"
	>
		<List>
			<ListItem @mousedown.prevent="blockStore.addBlock()">
				<span :class="[styles.Icon, styles.IconAdd]" />
				<span>Add below</span>
			</ListItem>
			<ListItem @mousedown.prevent="blockStore.duplicateBlock()">
				<span :class="[styles.Icon, styles.IconDuplicate]" />
				<span>Duplicate</span>
			</ListItem>
			<ListItem @mousedown.prevent="blockStore.deleteBlock()">
				<span :class="[styles.Icon, styles.IconTrash]" />
				<span>Delete</span>
			</ListItem>
		</List>
	</Popup>
</template>
