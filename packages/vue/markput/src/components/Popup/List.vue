<script setup lang="ts">
import styles from '@markput/core/styles.module.css'
</script>

<template>
	<ul :class="styles.PopupList">
		<slot />
	</ul>
</template>
