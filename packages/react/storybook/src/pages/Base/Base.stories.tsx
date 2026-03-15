import type {MarkProps, MarkedInputProps, Markup, Option} from '@markput/react'
import {MarkedInput} from '@markput/react'
import type {Meta, StoryObj} from '@storybook/react-vite'

import {Button} from '../../shared/components/Button'
import type {ButtonProps} from '../../shared/components/Button'

export default {
	title: 'MarkedInput',
	tags: ['autodocs'],
	component: MarkedInput,
	args: {},
} satisfies Meta<typeof MarkedInput>

type Story = StoryObj<Meta<typeof MarkedInput<MarkProps>>>

export const Default: Story = {
	args: {
		Mark: (props: MarkProps) => <mark onClick={_ => alert(props.meta)}>{props.value}</mark>,
		defaultValue: 'Hello, clickable marked @[world](Hello! Hello!)!',
	},
}

const PrimaryMarkup: Markup = '@[__value__](primary:__meta__)'
const DefaultMarkup: Markup = '@[__value__](default:__meta__)'

const configuredOptions: Option<ButtonProps>[] = [
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

export const Configured: StoryObj<MarkedInputProps<ButtonProps>> = {
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
				onClick: _ => console.log('onCLick'),
				onInput: _ => console.log('onInput'),
				onBlur: _ => console.log('onBlur'),
				onFocus: _ => console.log('onFocus'),
				onKeyDown: _ => console.log('onKeyDown'),
			},
		},
	},
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