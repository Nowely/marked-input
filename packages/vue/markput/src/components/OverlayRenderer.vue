<script setup lang="ts">
import type {OverlayMatch} from '@markput/core'
import {computed, type Ref} from 'vue'

import {useSlot} from '../lib/hooks/useSlot'
import {useStore} from '../lib/hooks/useStore'
import type {Option} from '../types'
import Suggestions from './Suggestions/Suggestions.vue'

const store = useStore()
const overlayMatchRef = store.state.overlayMatch.use() as Ref<OverlayMatch<Option> | undefined>

const overlayKey = computed(() => (overlayMatchRef.value ? store.key.get(overlayMatchRef.value.option) : undefined))

const resolved = computed(() => {
	const match = overlayMatchRef.value
	if (!match) return null
	return useSlot('overlay', match.option, undefined, Suggestions)
})
</script>

<template>
	<component v-if="overlayKey && resolved" :is="resolved[0]" :key="overlayKey" v-bind="resolved[1]" />
</template>
