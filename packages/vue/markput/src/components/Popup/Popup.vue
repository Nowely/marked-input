<script setup lang="ts">
import type {CSSProperties, ComponentPublicInstance} from 'vue'

import styles from '@markput/core/styles.module.css'

const props = defineProps<{
	style?: CSSProperties | string | Record<string, string>
	attachRef?: (el: HTMLElement | null) => void
}>()

function handleRef(el: Element | ComponentPublicInstance | null) {
	props.attachRef?.(el instanceof HTMLElement ? el : null)
}
</script>

<template>
	<div :ref="handleRef" :class="styles.Popup" :style="style">
		<slot />
	</div>
</template>
