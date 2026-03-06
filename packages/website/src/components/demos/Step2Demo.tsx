import {MarkedInput} from '@markput/react'

export const Step2Demo = () => (
	<MarkedInput
		defaultValue="Type @ to mention someone!"
		options={[
			{
				markup: '__value__',
				overlay: {
					trigger: '@',
					data: ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'],
				},
			},
		]}
	/>
)