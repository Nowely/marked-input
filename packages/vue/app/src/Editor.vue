<script setup lang="ts">
import type {MarkProps} from '@markput/vue'
import {MarkedInput} from '@markput/vue'
import {h, type FunctionalComponent} from 'vue'

import {MentionMarkup, TagMarkup} from './content'
import Overlay from './Overlay.vue'

const props = defineProps<{value: string}>()
const emit = defineEmits<{change: [value: string]; markClick: [message: string]}>()

const MentionChip: FunctionalComponent<MarkProps> = ({value, meta}) =>
	h(
		'button',
		{
			class: 'chip chip-mention',
			type: 'button',
			tabindex: -1,
			title: `@${meta}`,
			onClick: () => emit('markClick', `Clicked @${value} (${meta})`),
		},
		value ?? ''
	)

const TagChip: FunctionalComponent<MarkProps> = ({value}) => h('span', {class: 'chip chip-tag'}, `#${value ?? ''}`)

const options = [
	{markup: MentionMarkup, Mark: MentionChip, overlay: {trigger: '@'}},
	{markup: TagMarkup, Mark: TagChip, overlay: {trigger: '#'}},
]
</script>

<template>
	<div class="editor">
		<MarkedInput :options="options" :Overlay="Overlay" :value="props.value" @change="emit('change', $event)" />
	</div>
</template>
