import {useCallback} from 'react'
import {useArgs} from 'storybook/preview-api'

import {Text} from '../components/Text'

export const withPlainValue = (Story: any) => {
	const [args, updateArgs] = useArgs()

	const handleChange = useCallback(
		(newValue: string) => {
			updateArgs({value: newValue})
		},
		[updateArgs]
	)

	return (
		<>
			<Story args={{...args, onChange: handleChange}} />
			{args.value !== undefined && <Text label="Plain value:" value={args.value} />}
		</>
	)
}