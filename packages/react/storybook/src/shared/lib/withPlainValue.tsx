import {useCallback, useEffect, useRef, useState} from 'react'
import {useArgs, useGlobals} from 'storybook/preview-api'

import {PlainValuePanel} from '../components/Text'

export const withPlainValue = (Story: any, context: any) => {
	// Hooks must be called unconditionally (no early return before them).
	const [args, updateArgs] = useArgs()
	const [globals] = useGlobals()

	// In test environments useArgs() may return {} on the first render.
	// Merge context.args (initial story args) with the reactive args from useArgs().
	const mergedArgs = {...context.args, ...args}

	const isControlled = 'value' in mergedArgs
	const rawPosition = context.parameters?.plainValue as 'right' | 'bottom' | undefined
	const showPanel = rawPosition === 'right' || rawPosition === 'bottom'
	const showPlainValue = globals.showPlainValue !== 'hide'

	// displayValue tracks onChange synchronously so the panel stays up-to-date in
	// tests where updateArgs propagation is async.
	const [displayValue, setDisplayValue] = useState<string | undefined>((context.args as any)?.value)

	// Responsive: switch to 'bottom' when wrapper is narrower than 600px.
	const wrapperRef = useRef<HTMLDivElement>(null)
	const [effectivePosition, setEffectivePosition] = useState<'right' | 'bottom'>(rawPosition ?? 'right')

	useEffect(() => {
		const el = wrapperRef.current
		if (!el || !rawPosition) return
		const observer = new ResizeObserver(([entry]) => {
			const width = entry.contentRect.width
			setEffectivePosition(width < 600 ? 'bottom' : rawPosition)
		})
		observer.observe(el)
		return () => observer.disconnect()
	}, [rawPosition])

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

	if (effectivePosition === 'right') {
		return (
			<div ref={wrapperRef} style={{display: 'flex', height: '100%'}}>
				<div style={{flex: 3, minWidth: 0, overflowY: 'auto'}}>
					<Story args={storyArgs} />
				</div>
				{displayValue !== undefined && <PlainValuePanel value={displayValue} position="right" />}
			</div>
		)
	}

	return (
		<div ref={wrapperRef}>
			<Story args={storyArgs} />
			{displayValue !== undefined && (
				<>
					<div className="pvp-divider" />
					<PlainValuePanel value={displayValue} position="bottom" />
				</>
			)}
		</div>
	)
}