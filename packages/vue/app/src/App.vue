<script setup lang="ts">
import type {MarkProps, MarkToken, Markup} from '@markput/vue'
import {denote, MarkedInput} from '@markput/vue'
import {ref, computed, h, type FunctionalComponent} from 'vue'

const PrimaryMarkup: Markup = '@[__value__](primary:__meta__)'
const DefaultMarkup: Markup = '@[__value__](default:__meta__)'

const Button: FunctionalComponent<{label: string; primary?: boolean; onClick?: () => void}> = props => {
	return h(
		'button',
		{
			type: 'button',
			onClick: props.onClick,
			style: {
				backgroundColor: props.primary ? '#1ea7fd' : 'transparent',
				color: props.primary ? 'white' : '#333',
				border: props.primary ? 'none' : '1px solid #ccc',
				borderRadius: '3em',
				padding: '0.5em 1em',
				cursor: 'pointer',
				fontSize: '14px',
			},
		},
		props.label
	)
}

const options = [
	{
		markup: PrimaryMarkup,
		mark: ({value, meta}: MarkProps) => ({label: value || '', primary: true, onClick: () => alert(meta)}),
		overlay: {
			trigger: '@',
			data: ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'],
		},
	},
	{
		markup: DefaultMarkup,
		mark: ({value}: MarkProps) => ({label: value || ''}),
		overlay: {
			trigger: '/',
			data: ['Seventh', 'Eight', 'Ninth'],
		},
	},
]

const value = ref(
	"Enter the '@' for calling @[primary](primary:4) suggestions and '/' for @[default](default:7)!\n" +
		'Mark is can be a any component with any logic. In this example it is the @[Button](primary:54): clickable primary or secondary.\n' +
		'For found mark used @[annotations](default:123).'
)

const displayText = computed(() => denote(value.value, (mark: MarkToken) => mark.value, [PrimaryMarkup, DefaultMarkup]))

function onChange(v: string) {
	value.value = v
}
</script>

<template>
	<MarkedInput
		:Mark="Button"
		:options="options"
		:value="value"
		:slotProps="{
			container: {
				onClick: () => console.log('onClick'),
				onInput: () => console.log('onInput'),
				onBlur: () => console.log('onBlur'),
				onFocus: () => console.log('onFocus'),
				onKeydown: () => console.log('onKeyDown'),
			},
		}"
		@change="onChange"
	/>

	<br />
	<b>Plain text:</b>
	<pre>{{ value }}</pre>
	<b>Display text (denoted):</b>
	<pre>{{ displayText }}</pre>
</template>
