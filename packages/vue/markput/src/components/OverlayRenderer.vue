<script setup lang="ts">
import type {CoreOption, OverlayMatch} from '@markput/core'
import {computed, type Component, type Ref} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import type {Option, OverlayProps} from '../types'
import Suggestions from './Suggestions/Suggestions.vue'

const store = useStore()
const overlayMatchRef = useMarkput(s => s.state.overlayMatch) as Ref<OverlayMatch<Option> | undefined>
const overlayKey = computed(() => (overlayMatchRef.value ? store.key.get(overlayMatchRef.value.option) : undefined))
// oxlint-disable-next-line no-unsafe-type-assertion -- OverlaySlot returns [unknown, unknown] in core; Vue-specific type asserted here
const resolveOverlay = useMarkput(s => s.computed.overlay) as Ref<
	(option?: CoreOption, defaultComponent?: unknown) => readonly [Component, OverlayProps]
>

const resolved = computed(() => {
	const match = overlayMatchRef.value
	if (!match) return null
	return resolveOverlay.value(match.option, Suggestions)
})
</script>

<template>
	<component v-if="overlayKey && resolved" :is="resolved[0]" :key="overlayKey" v-bind="resolved[1]" />
</template>
