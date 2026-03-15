import {useCallback, useState} from 'react'
import {useArgs, useGlobals} from 'storybook/preview-api'

import {Text} from '../components/Text'

export const withPlainValue = (Story: any, context: any) => {
	if (context.parameters?.plainValue === false) {
		return <Story />
	}
	const [args, updateArgs] = useArgs()
	const [globals] = useGlobals()
	const isControlled = 'value' in args
	const showPlainValue = globals.showPlainValue !== 'hide'

	// displayValue tracks onChange synchronously so <Text> stays up-to-date in
	// tests where updateArgs propagation is async.
	const [displayValue, setDisplayValue] = useState(args.value)

	const handleChange = useCallback(
		(newValue: string) => {
			setDisplayValue(newValue)
			updateArgs({value: newValue})
		},
		[updateArgs]
	)

	// Only wrap controlled stories (those with `value` in args).
	// Uncontrolled stories use `defaultValue` — overriding onChange would inject
	// `value` back via updateArgs, switching them to controlled mode.
	if (!isControlled) {
		return <Story />
	}

	const storyArgs = {...args, onChange: handleChange}

	if (!showPlainValue) {
		return <Story args={storyArgs} />
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
				<Story args={storyArgs} />
			</div>
			{displayValue !== undefined && (
				<div style={{flex: 2, minWidth: 0}}>
					<Text label="Plain value:" value={displayValue} className="text-inset" />
				</div>
			)}
		</div>
	)
}