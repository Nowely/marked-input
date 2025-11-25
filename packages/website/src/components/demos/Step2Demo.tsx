import {MarkedInput, type MarkProps} from 'rc-marked-input'
import {useState} from 'react'

const Mark = ({value}: MarkProps) => <mark>{value}</mark>

export function Step2Demo() {
	const [value, setValue] = useState('Type @ to mention someone!')

	return (
		<MarkedInput
			Mark={Mark}
			value={value}
			onChange={setValue}
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
