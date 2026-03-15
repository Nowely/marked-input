import {useCallback} from 'react'
import {useArgs, useGlobals} from 'storybook/preview-api'

import {Text} from '../components/Text'

export const withPlainValue = (Story: any) => {
	const [args, updateArgs] = useArgs()
	const [globals] = useGlobals()
	const showPlainValue = globals.showPlainValue !== 'hide'

	const handleChange = useCallback(
		(newValue: string) => {
			updateArgs({value: newValue})
		},
		[updateArgs]
	)

	if (!showPlainValue) {
		return <Story args={{...args, onChange: handleChange}} />
	}

	return (
		<div
			style={{
				display: 'flex',
				border: '1px solid #d0d7de',
				borderRadius: 6,
				overflow: 'hidden',
				alignItems: 'stretch',
			}}
		>
			<div style={{flex: 3, minWidth: 0}}>
				<Story args={{...args, onChange: handleChange}} />
			</div>
			{args.value !== undefined && (
				<div style={{flex: 2, minWidth: 0}}>
					<Text label="Plain value:" value={args.value} className="text-inset" />
				</div>
			)}
		</div>
	)
}