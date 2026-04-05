<script setup lang="ts">
defineProps<{
	value: string
	label?: string
}>()
</script>

<template>
	<br />
	<b v-if="label">{{ label }}</b>
	<pre>{{ value }}</pre>
</template>

<style>
pre {
	font-family:
		Apple-System,
		Arial,
		Helvetica,
		PingFang SC,
		Hiragino Sans GB,
		Microsoft YaHei,
		STXihei,
		sans-serif;
	font-size: 14px;
}
</style>
