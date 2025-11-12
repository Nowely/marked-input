import {Meta, StoryObj} from '@storybook/react-vite'
import {createMarkedInput, MarkedInput, denote} from 'rc-marked-input'
import type {Markup, MarkToken} from 'rc-marked-input'
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
			data: ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'],
			initMark: ({value, meta}) => ({label: value, primary: true, onClick: () => alert(meta)}),
		},
		{
			markup: DefaultMarkup,
			trigger: '/',
			data: ['Seventh', 'Eight', 'Ninth'],
			initMark: ({value}) => ({label: value}),
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
				<ConfiguredMarkedInput value={value} onChange={setValue}>
					<div
						onClick={_ => console.log('onCLick')}
						onInput={_ => console.log('onInput')}
						onBlur={_ => console.log('onBlur')}
						onFocus={_ => console.log('onFocus')}
						onKeyDown={_ => console.log('onKeyDown')}
					/>
				</ConfiguredMarkedInput>

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
				data: ['one', 'two', 'three', 'four'],
			},
		],
	},
}
