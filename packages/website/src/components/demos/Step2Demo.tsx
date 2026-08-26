import {MarkedInput} from '@markput/react'

export const Step2Demo = () => (
	<MarkedInput
		Mark={({value}) => <mark>@{value}</mark>}
		defaultValue="Type @ to mention someone!"
		options={[
			{
				markup: '@[__value__]',
				overlay: {
					trigger: '@',
					data: ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'],
				},
			},
		]}
	/>
)