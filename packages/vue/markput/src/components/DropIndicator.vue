<script setup lang="ts">
import type {Token as TokenType} from '@markput/core'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'

import styles from '@markput/core/styles.module.css'

const props = defineProps<{token: TokenType; position: 'before' | 'after'}>()

const store = useStore()
const blockStore = store.blocks.get(props.token)
const index = useMarkput(s => s.parsing.index)
const dropPosition = useMarkput(() => blockStore.state.dropPosition)

let dropControlRef: ((element: HTMLElement | null) => void) | undefined

const getDropControlRef = () => {
	if (dropControlRef) return dropControlRef
	const path = index.value.pathFor(props.token)
	if (!path) return undefined
	dropControlRef = store.dom.controlFor(path)
	return dropControlRef
}

const setDropRef = (el: unknown) => {
	getDropControlRef()?.(el as HTMLElement | null)
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
