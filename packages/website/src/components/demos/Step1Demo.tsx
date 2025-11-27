import {MarkedInput} from 'rc-marked-input'

export const Step1Demo = () => (
	<MarkedInput
		Mark={({value, meta}) => <mark onClick={() => alert(meta)}>{value}</mark>}
		defaultValue="Hello @[World](123)!"
	/>
)
