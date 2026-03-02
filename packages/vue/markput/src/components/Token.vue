<script setup lang="ts">
import {provide, toRef} from 'vue'
import type {Token as TokenType} from '@markput/core'
import {TOKEN_KEY} from '../lib/providers/tokenKey'
// eslint-disable-next-line import/no-cycle
import MarkRenderer from './MarkRenderer.vue'
import TextSpan from './TextSpan.vue'

const props = withDefaults(
	defineProps<{
		mark: TokenType
		isNested?: boolean
	}>(),
	{
		isNested: false,
	}
)

provide(
	TOKEN_KEY,
	toRef(() => props.mark)
)
</script>

<template>
	<MarkRenderer v-if="mark.type === 'mark'" />
	<template v-else-if="isNested">{{ mark.content }}</template>
	<TextSpan v-else />
</template>
