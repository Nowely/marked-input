<script setup lang="ts">
import type {OverlayMatch} from '@markput/core'
import {computed, type Ref} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import type {Option} from '../types'
import Suggestions from './Suggestions/Suggestions.vue'

const store = useStore()
// oxlint-disable-next-line no-unsafe-type-assertion -- narrows generic OverlayMatch<CoreOption> → OverlayMatch<Option>; unrelated to Slot typing
const matchRef = useMarkput(s => s.overlay.match) as Ref<OverlayMatch<Option> | undefined>
const overlayKey = computed(() => (matchRef.value ? store.key.get(matchRef.value.option) : undefined))
const resolveOverlay = useMarkput(s => s.overlay.slot)

const resolved = computed(() => {
	const match = matchRef.value
	if (!match) return null
	return resolveOverlay.value(match.option, Suggestions)
})
</script>

<template>
	<component v-if="overlayKey && resolved" :is="resolved[0]" :key="overlayKey" v-bind="resolved[1]" />
</template>
