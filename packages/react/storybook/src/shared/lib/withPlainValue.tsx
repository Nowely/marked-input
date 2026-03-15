import {useCallback, useState} from 'react'
import {useArgs, useGlobals} from 'storybook/preview-api'

import {Text} from '../components/Text'

export const withPlainValue = (Story: any, context: any) => {
	// Hooks must be called unconditionally (no early return before them).
	const [args, updateArgs] = useArgs()
	const [globals] = useGlobals()

	// In test environments useArgs() may return {} on the first render.
	// Merge context.args (initial story args) with the reactive args from useArgs().
	const mergedArgs = {...context.args, ...args}

	const isControlled = 'value' in mergedArgs
	const showPanel = context.parameters?.plainValue === true
	const showPlainValue = globals.showPlainValue !== 'hide'

	// displayValue tracks onChange synchronously so <Text> stays up-to-date in
	// tests where updateArgs propagation is async.
	const [displayValue, setDisplayValue] = useState<string | undefined>((context.args as any)?.value)

	const handleChange = useCallback(
		(newValue: string) => {
			setDisplayValue(newValue)
			updateArgs({value: newValue})
		},
		[updateArgs]
	)

	// Only wrap controlled stories that opted in to the panel.
	// Uncontrolled stories use `defaultValue` — overriding onChange would inject
	// `value` back via updateArgs, switching them to controlled mode.
	if (!showPanel || !isControlled) {
		return <Story />
	}

	const storyArgs = {...mergedArgs, onChange: handleChange}

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