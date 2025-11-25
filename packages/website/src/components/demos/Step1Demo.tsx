import {MarkedInput} from 'rc-marked-input'
import {useState} from 'react'

export function Step1Demo() {
	const [value, setValue] = useState('Hello @[World](meta)!')

	return (
		<MarkedInput
			value={value}
			onChange={setValue}
			Mark={props => <mark>{props.value}</mark>}
		/>
	)
}
