<script setup lang="ts">
import type {OverlayMatch} from '@markput/core'
import {computed, type Ref} from 'vue'

import {useStore} from '../lib/hooks/useStore'
import type {Option} from '../types'
import Suggestions from './Suggestions/Suggestions.vue'

const store = useStore()
const overlayMatchRef = store.state.overlayMatch.use() as Ref<OverlayMatch<Option> | undefined>
const overlayKey = computed(() => (overlayMatchRef.value ? store.key.get(overlayMatchRef.value.option) : undefined))
const resolveOverlay = store.computed.overlay.use()

const resolved = computed(() => {
	const match = overlayMatchRef.value
	if (!match) return null
	return resolveOverlay.value(match.option, Suggestions)
})
</script>

<template>
	<component v-if="overlayKey && resolved" :is="resolved[0]" :key="overlayKey" v-bind="resolved[1]" />
</template>
