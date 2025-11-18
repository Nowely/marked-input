import type {Meta, StoryObj} from '@storybook/react-vite'
import {MarkedInput, createMarkedInput, denote} from 'rc-marked-input'
import type {MarkToken, Markup} from 'rc-marked-input'
import {useState} from 'react'
import {Button} from '../assets/Button'
import {Text} from '../assets/Text'

export default {
	title: 'MarkedInput',
	tags: ['autodocs'],
	component: MarkedInput,
	args: {},
} satisfies Meta<typeof MarkedInput>

type Story = StoryObj<Meta<typeof MarkedInput<MarkToken>>>

export const Default: Story = {
	args: {
		Mark: props => <mark onClick={_ => alert(props.meta)}>{props.value}</mark>,
		defaultValue: 'Hello, clickable marked @[world](Hello! Hello!)!',
	},
}

const PrimaryMarkup: Markup = '@[__value__](primary:__meta__)'
const DefaultMarkup: Markup = '@[__value__](default:__meta__)'

const ConfiguredMarkedInput = createMarkedInput({
	Mark: Button,
	options: [
		{
			markup: PrimaryMarkup,
			slotProps: {
				mark: ({value, meta}) => ({label: value || '', primary: true, onClick: () => alert(meta)}),
				overlay: {
					trigger: '@',
					data: ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'],
				},
			},
		},
		{
			markup: DefaultMarkup,
			slotProps: {
				mark: ({value}) => ({label: value || ''}),
				overlay: {
					trigger: '/',
					data: ['Seventh', 'Eight', 'Ninth'],
				},
			},
		},
	],
})

export const Configured: Story = {
	render: () => {
		const [value, setValue] = useState(
			"Enter the '@' for calling @[primary](primary:4) suggestions and '/' for @[default](default:7)!\n" +
				'Mark is can be a any component with any logic. In this example it is the @[Button](primary:54): clickable primary or secondary.\n' +
				'For found mark used @[annotations](default:123).'
		)

		const displayText = denote(value, (mark: MarkToken) => mark.value, [PrimaryMarkup, DefaultMarkup])

		return (
			<>
				<ConfiguredMarkedInput
					value={value}
					onChange={setValue}
					slotProps={{
						container: {
							onClick: _ => console.log('onCLick'),
							onInput: _ => console.log('onInput'),
							onBlur: _ => console.log('onBlur'),
							onFocus: _ => console.log('onFocus'),
							onKeyDown: _ => console.log('onKeyDown'),
						},
					}}
				/>

				<Text label="Plaint text:" value={value} />
				<Text label="Display text (denoted):" value={displayText} />
			</>
		)
	},
}

export const Autocomplete: Story = {
	args: {
		defaultValue: 'Hello, clickable marked @world!',
		options: [
			{
				markup: '@__value__' as Markup,
				slotProps: {
					overlay: {
						trigger: '@',
						data: ['one', 'two', 'three', 'four'],
					},
				},
			},
		],
	},
}
