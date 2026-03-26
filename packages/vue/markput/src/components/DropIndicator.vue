<script setup lang="ts">
import type {Token as TokenType} from '@markput/core'

import {useStore} from '../lib/hooks/useStore'

import styles from '@markput/core/styles.module.css'

const props = defineProps<{token: TokenType; position: 'before' | 'after'}>()

const store = useStore()
const blockStore = store.blocks.get(props.token)
const dropPosition = blockStore.state.dropPosition.use()
</script>

<template>
	<div
		v-if="dropPosition === position"
		:class="styles.DropIndicator"
		:style="position === 'before' ? {top: '-1px'} : {bottom: '-1px'}"
	/>
</template>
