import {MarkedInput} from 'rc-marked-input'
import {useState} from 'react'

export function Step2Demo() {
	const [value, setValue] = useState('Type @ to mention someone!')

	return (
		<MarkedInput
			value={value}
			onChange={setValue}
			Mark={props => <mark>@{props.value}</mark>}
			options={[
				{
					markup: '@[__value__](__meta__)',
					slotProps: {
						overlay: {
							trigger: '@',
							data: ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'],
						},
					},
				},
			]}
		/>
	)
}
