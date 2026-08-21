<script setup lang="ts">
import {BLOCK_MENU_ITEMS} from '@markput/core'
import type {TreeNode} from '@markput/core'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import List from './Popup/List.vue'
import ListItem from './Popup/ListItem.vue'
import Popup from './Popup/Popup.vue'

const props = defineProps<{node: TreeNode}>()

const store = useStore()
const blockStore = store.block.get(props.node)
const menuOpen = useMarkput(() => blockStore.state.menuOpen)
const menuPosition = useMarkput(() => blockStore.state.menuPosition)

const menuControlRef = store.tokens.control()

const setMenuRef = (el: HTMLElement | null) => {
	blockStore.attachMenu(el)
	menuControlRef(el)
}
</script>

<template>
	<Popup
		v-if="menuOpen"
		:attach-ref="setMenuRef"
		:style="{top: menuPosition.top + 'px', left: menuPosition.left + 'px'}"
	>
		<List>
			<ListItem v-for="item in BLOCK_MENU_ITEMS" :key="item.label" @mousedown.prevent="item.run(blockStore)">
				<span :class="item.iconClass" />
				<span>{{ item.label }}</span>
			</ListItem>
		</List>
	</Popup>
</template>
