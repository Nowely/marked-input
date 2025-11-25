import {MarkedInput} from 'rc-marked-input'
import {useState} from 'react'

export function Step1Demo() {
	const [value, setValue] = useState('Hello @[World](user:123)!')

	return (
		<MarkedInput
			value={value}
			onChange={setValue}
			Mark={props => (
				<mark onClick={() => alert(`Clicked: ${props.value}\nID: ${props.meta}`)}>
					{props.value}
				</mark>
			)}
		/>
	)
}
