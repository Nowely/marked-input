<script setup lang="ts">
import {ref, watch} from 'vue'

import styles from '@markput/core/styles.module.css'

const props = defineProps<{active?: boolean}>()

const itemEl = ref<HTMLLIElement | null>(null)

watch(
	() => props.active,
	val => {
		if (val) itemEl.value?.scrollIntoView(false)
	}
)
</script>

<template>
	<li ref="itemEl" :class="[styles.PopupItem, active && styles.PopupItemActive]">
		<slot />
	</li>
</template>
