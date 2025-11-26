import {MarkedInput} from 'rc-marked-input'

export const Step2Demo = () => (
	<MarkedInput
		Mark={({value}) => <mark>{value}</mark>}
		defaultValue='Type @ to mention someone!'
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
