import {MarkedInput} from 'rc-marked-input'

export const Step2Demo = () => (
	<MarkedInput
		defaultValue='Type @ to mention someone!'
		options={[
			{
				markup: '__value__',
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
