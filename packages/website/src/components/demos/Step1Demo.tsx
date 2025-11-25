import {MarkedInput} from 'rc-marked-input'
import {useState} from 'react'

export function Step1Demo() {
	const [value, setValue] = useState('Hello @[World](123)!')

	return (
		<MarkedInput
			Mark={props => <mark onClick={() => alert(props.meta)}>{props.value}</mark>}
			value={value}
			onChange={setValue}
		/>
	)
}
