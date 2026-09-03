<script setup lang="ts">
import {key, type OverlayMatch} from '@markput/core'
import {computed, type Ref} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import type {Option} from '../types'
import OverlayList from './OverlayList/OverlayList.vue'

const matchRef = useMarkput(s => s.overlay.match) as Ref<OverlayMatch<Option> | undefined>
const overlayKey = computed(() => (matchRef.value ? key.get(matchRef.value.option) : undefined))
const resolveOverlay = useMarkput(s => s.overlay.slot)

const resolved = computed(() => {
	const match = matchRef.value
	if (!match) return null
	return resolveOverlay.value(match.option, OverlayList)
})
</script>

<template>
	<component v-if="overlayKey && resolved" :is="resolved[0]" :key="overlayKey" v-bind="resolved[1]" />
</template>
