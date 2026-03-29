<script setup lang="ts">
import {resolveOptionSlot} from '@markput/core'
import type {OverlayMatch} from '@markput/core'
import {computed, type Component, type Ref} from 'vue'

import {useStore} from '../lib/hooks/useStore'
import type {Option} from '../types'
import Suggestions from './Suggestions/Suggestions.vue'

const store = useStore()
const overlayMatchRef = store.state.overlayMatch.use() as Ref<OverlayMatch<Option> | undefined>
const GlobalOverlayRef = store.state.Overlay.use() as Ref<Component | undefined>

const overlayKey = computed(() => (overlayMatchRef.value ? store.key.get(overlayMatchRef.value.option) : undefined))

const resolved = computed(() => {
	const match = overlayMatchRef.value
	if (!match) return null
	const option = match.option
	const Comp = (option?.Overlay || GlobalOverlayRef.value || Suggestions) as Component
	const props = resolveOptionSlot(option?.overlay, {})
	return [Comp, props] as const
})
</script>

<template>
	<component v-if="overlayKey && resolved" :is="resolved[0]" :key="overlayKey" v-bind="resolved[1]" />
</template>
