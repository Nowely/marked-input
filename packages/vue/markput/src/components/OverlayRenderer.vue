<script setup lang="ts">
import type {OverlayMatch} from '@markput/core'
import {computed, type Ref, type Component} from 'vue'

import {useStore} from '../lib/hooks/useStore'
import type {Option} from '../types'
import Suggestions from './Suggestions/Suggestions.vue'

const store = useStore()
const overlayMatchRef = store.state.overlayMatch.use() as Ref<OverlayMatch<Option> | undefined>
const OverlayRef = store.state.Overlay.use() as Ref<Component | undefined>

const overlayKey = computed(() => (overlayMatchRef.value ? store.key.get(overlayMatchRef.value.option) : undefined))

const resolved = computed(() => {
	const match = overlayMatchRef.value
	if (!match) return null

	const optionOverlay = match.option?.overlay as any
	const Comp = (optionOverlay?.slot || OverlayRef.value || Suggestions) as Component
	const props = optionOverlay ?? {}

	return {Comp, props}
})
</script>

<template>
	<component v-if="overlayKey && resolved" :is="resolved.Comp" :key="overlayKey" v-bind="resolved.props" />
</template>
