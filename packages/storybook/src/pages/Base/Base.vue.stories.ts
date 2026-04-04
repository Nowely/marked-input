import type {MarkProps, Markup, Option} from '@markput/vue'
import {MarkedInput} from '@markput/vue'
import type {Meta, StoryObj} from '@storybook/vue3-vite'
import {defineComponent, h} from 'vue'

import Button from '../../shared/components/Button/Button.vue'

export default {
	title: 'MarkedInput',
	tags: ['autodocs'],
	component: MarkedInput,
} satisfies Meta<typeof MarkedInput>

type Story = StoryObj<Meta<typeof MarkedInput>>

export const Default: Story = {
	args: {
		Mark: defineComponent({
			props: {value: String, meta: String},
			setup(props) {
				return () => h('mark', {onClick: () => alert(props.meta)}, props.value)
			},
		}),
		defaultValue: 'Hello, clickable marked @[world](Hello! Hello!)!',
	},
}

const PrimaryMarkup: Markup = '@[__value__](primary:__meta__)'
const DefaultMarkup: Markup = '@[__value__](default:__meta__)'

const configuredOptions: Option[] = [
	{
		markup: PrimaryMarkup,
		mark: ({value, meta}: MarkProps) => ({label: value ?? '', primary: true, onClick: () => alert(meta)}),
		overlay: {
			trigger: '@',
			data: ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'],
		},
	},
	{
		markup: DefaultMarkup,
		mark: ({value}: MarkProps) => ({label: value ?? ''}),
		overlay: {
			trigger: '/',
			data: ['Seventh', 'Eight', 'Ninth'],
		},
	},
]

export const Configured: Story = {
	parameters: {plainValue: 'right'},
	args: {
		Mark: Button,
		options: configuredOptions,
		value:
			"Enter the '@' for calling @[primary](primary:4) suggestions and '/' for @[default](default:7)!\n" +
			'Mark is can be a any component with any logic. In this example it is the @[Button](primary:54): clickable primary or secondary.\n' +
			'For found mark used @[annotations](default:123).',
		slotProps: {
			container: {
				onClick: () => console.log('onClick'),
				onInput: () => console.log('onInput'),
				onBlur: () => console.log('onBlur'),
				onFocus: () => console.log('onFocus'),
				onKeydown: () => console.log('onKeyDown'),
			},
		},
	},
}

export const Autocomplete: Story = {
	args: {
		defaultValue: 'Hello, clickable marked @world!',
		options: [
			{
				// oxlint-disable-next-line no-unsafe-type-assertion
				markup: '@__value__' as Markup,
				overlay: {
					trigger: '@',
					data: ['one', 'two', 'three', 'four'],
				},
			},
		],
	},
}