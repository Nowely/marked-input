import {MarkedInput} from 'rc-marked-input'

export const Step1Demo = () => (
	<MarkedInput
		Mark={props => <mark onClick={() => alert(props.meta)}>{props.value}</mark>}
		defaultValue='Hello @[World](123)!' />
)
