import React, {useState} from 'react'
import ReactDOM from 'react-dom/client'
import './style.css'
import {createMarkedInput, denote} from 'rc-marked-input'
import type {MarkToken, Markup} from 'rc-marked-input'

const PrimaryMarkup: Markup = '@[__value__](primary:__meta__)'
const DefaultMarkup: Markup = '@[__value__](default:__meta__)'

const Button = ({
	label,
	primary,
	onClick,
}: {
	label: string
	primary?: boolean
	onClick?: () => void
}) => (
	<button
		type="button"
		onClick={onClick}
		style={{
			backgroundColor: primary ? '#1ea7fd' : 'transparent',
			color: primary ? 'white' : '#333',
			border: primary ? 'none' : '1px solid #ccc',
			borderRadius: '3em',
			padding: '0.5em 1em',
			cursor: 'pointer',
			fontSize: '14px',
		}}
	>
		{label}
	</button>
)

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

const App = () => {
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
						onClick: () => console.log('onClick'),
						onInput: () => console.log('onInput'),
						onBlur: () => console.log('onBlur'),
						onFocus: () => console.log('onFocus'),
						onKeyDown: () => console.log('onKeyDown'),
					},
				}}
			/>

			<br />
			<b>Plain text:</b>
			<pre>{value}</pre>
			<b>Display text (denoted):</b>
			<pre>{displayText}</pre>
		</>
	)
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
)
