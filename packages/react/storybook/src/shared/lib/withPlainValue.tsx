import type {Decorator} from '@storybook/react'
import {useCallback, useEffect, useRef, useState} from 'react'
import type {ComponentType} from 'react'
import {useArgs, useGlobals} from 'storybook/preview-api'

import {PlainValuePanel} from '../components/Text'

// ─── Proper React component that owns all local state ─────────────────────────
// withPlainValue (a Storybook decorator) is NOT called as a React component —
// it is invoked as a plain function inside Storybook's hookify wrapper.
// Calling React hooks (useState, useEffect) from that context can produce
// undefined initial state on the first render.
// PanelContainer IS a real React component: React creates a dedicated fiber
// for it, so useState always initialises correctly.

interface PanelContainerProps {
	Story: ComponentType<{args?: Record<string, unknown>}>
	args: Record<string, unknown>
	value: string
	position: 'right' | 'bottom'
	updateArgs: (update: Record<string, unknown>) => void
}

function PanelContainer({Story, args, value: valueProp, position: positionProp, updateArgs}: PanelContainerProps) {
	const [value, setValue] = useState(valueProp)
	const [prevValueProp, setPrevValueProp] = useState(valueProp)

	// Sync when the external value changes (e.g. Storybook controls panel).
	// getDerivedStateFromProps pattern: call setState during render when prop drifts.
	if (valueProp !== prevValueProp) {
		setPrevValueProp(valueProp)
		setValue(valueProp)
	}

	const wrapperRef = useRef<HTMLDivElement>(null)
	const [position, setPosition] = useState<'right' | 'bottom'>(positionProp)

	// Responsive: switch to 'bottom' when wrapper is narrower than 600px.
	useEffect(() => {
		const el = wrapperRef.current
		if (!el) return
		const observer = new ResizeObserver(([entry]) => {
			setPosition(entry.contentRect.width < 600 ? 'bottom' : positionProp)
		})
		observer.observe(el)
		return () => observer.disconnect()
	}, [positionProp])

	const handleChange = useCallback(
		(newValue: string) => {
			setValue(newValue)
			updateArgs({value: newValue})
		},
		[updateArgs]
	)

	const storyArgs = {...args, value, onChange: handleChange}

	if (position === 'right') {
		return (
			<div ref={wrapperRef} style={{display: 'flex', height: '100%'}}>
				<div style={{flex: 3, minWidth: 0, overflowY: 'auto'}}>
					<Story args={storyArgs} />
				</div>
				<PlainValuePanel value={value} position="right" />
			</div>
		)
	}

	return (
		<div ref={wrapperRef}>
			<Story args={storyArgs} />
			<div className="pvp-divider" />
			<PlainValuePanel value={value} position="bottom" />
		</div>
	)
}

// ─── Global Storybook decorator ───────────────────────────────────────────────

export const withPlainValue: Decorator = (Story, context) => {
	// Only Storybook hooks at this level — no React hooks.
	/* oxlint-disable no-unsafe-member-access */
	const [args, updateArgs] = useArgs()
	const [globals] = useGlobals()

	const mergedArgs = {...context.args, ...args}
	const isControlled = 'value' in mergedArgs
	const plainValue = context.parameters?.plainValue
	const rawPosition = (plainValue === 'right' || plainValue === 'bottom' ? plainValue : undefined) as
		| 'right'
		| 'bottom'
		| undefined
	const showPanel = rawPosition === 'right' || rawPosition === 'bottom'
	const rawGlobal = globals.showPlainValue ?? 'right'
	const globalValue = (
		rawGlobal === 'right' || rawGlobal === 'bottom' || rawGlobal === 'hide' ? rawGlobal : 'right'
	) as
		// oxlint-disable-next-line no-unsafe-type-assertion
		'right' | 'bottom' | 'hide'
	const showPlainValue = globalValue !== 'hide'

	// Stories that don't opt in to the panel, or are uncontrolled.
	if (!showPanel || !isControlled) {
		return <Story />
	}

	// Panel opted in but globally hidden — still wire onChange so controls stay in sync.
	if (!showPlainValue) {
		return <Story args={{...mergedArgs, onChange: (v: string) => updateArgs({value: v})}} />
	}

	const position = rawPosition

	return (
		<PanelContainer
			Story={Story}
			args={mergedArgs}
			value={mergedArgs.value ?? ''}
			position={position}
			updateArgs={updateArgs}
		/>
	)
}