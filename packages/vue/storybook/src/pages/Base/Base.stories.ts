import type {Meta, StoryObj} from '@storybook/vue3-vite'
import {defineComponent, h, ref, computed} from 'vue'
import type {MarkProps, MarkToken, Markup} from '@markput/vue'
import {denote, MarkedInput} from '@markput/vue'
import Button from '../../shared/components/Button.vue'
import Text from '../../shared/components/Text.vue'

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

const configuredOptions = [
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

export const Configured: Story = {
	render: () =>
		defineComponent({
			setup() {
				const value = ref(
					"Enter the '@' for calling @[primary](primary:4) suggestions and '/' for @[default](default:7)!\n" +
						'Mark is can be a any component with any logic. In this example it is the @[Button](primary:54): clickable primary or secondary.\n' +
						'For found mark used @[annotations](default:123).'
				)

				const displayText = computed(() =>
					denote(value.value, (mark: MarkToken) => mark.value, [PrimaryMarkup, DefaultMarkup])
				)

				return () => [
					h(MarkedInput, {
						Mark: Button,
						options: configuredOptions,
						value: value.value,
						onChange: (v: string) => {
							value.value = v
						},
						slotProps: {
							container: {
								onClick: () => console.log('onClick'),
								onInput: () => console.log('onInput'),
								onBlur: () => console.log('onBlur'),
								onFocus: () => console.log('onFocus'),
								onKeydown: () => console.log('onKeyDown'),
							},
						},
					}),
					h(Text, {label: 'Plain text:', value: value.value}),
					h(Text, {label: 'Display text (denoted):', value: displayText.value}),
				]
			},
		}),
}

export const Autocomplete: Story = {
	args: {
		defaultValue: 'Hello, clickable marked @world!',
		options: [
			{
				markup: '@__value__' as Markup,
				overlay: {
					trigger: '@',
					data: ['one', 'two', 'three', 'four'],
				},
			},
		],
	},
}
