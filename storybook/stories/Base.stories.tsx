import {Meta, StoryObj} from '@storybook/react'
import {createMarkedInput, denote, MarkedInput, MarkStruct, Markup} from 'rc-marked-input'
import {useState} from 'react'
import {Button} from '../assets/Button'
import {Text} from '../assets/Text'

export default {
	title: 'MarkedInput',
	tags: ['autodocs'],
	component: MarkedInput,
	args: {

	}
} satisfies Meta<typeof MarkedInput>

type Story = StoryObj<typeof MarkedInput<MarkStruct>>

const Mark = (props: MarkStruct) => <mark onClick={_ => alert(props.value)}>{props.label}</mark>

export const Default: Story = {
	args: {
		Mark: (props) => <mark onClick={_ => alert(props.value)}>{props.label}</mark>,
		defaultValue: 'Hello, clickable marked @[world](Hello! Hello!)!',
	}
}

const PrimaryMarkup: Markup = '@[__label__](primary:__value__)'
const DefaultMarkup: Markup = '@[__label__](default:__value__)'

const ConfiguredMarkedInput = createMarkedInput({
	Mark: Button,
	options: [{
		markup: PrimaryMarkup,
		data: ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'],
		initMark: ({label, value}) => ({label, primary: true, onClick: () => alert(value)})
	}, {
		markup: DefaultMarkup,
		trigger: '/',
		data: ['Seventh', 'Eight', 'Ninth'],
		initMark: ({label}) => ({label})
	}],
})

export const Configured = () => {
	const [value, setValue] = useState(
		'Enter the \'@\' for calling @[primary](primary:4) suggestions and \'/\' for @[default](default:7)!\n' +
		'Mark is can be a any component with any logic. In this example it is the @[Button](primary:54): clickable primary or secondary.\n' +
		'For found mark used @[annotations](default:123).'
	)

	const displayText = denote(value, mark => mark.label, PrimaryMarkup, DefaultMarkup)

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

			<Text label="Plaint text:" value={value}/>
			<Text label="Display text (denoted):" value={displayText}/>
		</>
	)
}

export const Autocomplete = () => {
	const [value, setValue] = useState('Hello, clickable marked @world!')
	return (
		<MarkedInput value={value} onChange={setValue} options={[{
			markup: '@__label__',
			data: ['one', 'two', 'three', 'four']
		}]}/>
	)
}