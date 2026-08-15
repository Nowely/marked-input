import {MarkedInput} from '@markput/react'
import type {HTMLAttributes, KeyboardEvent, Ref} from 'react'
import {useState} from 'react'

import {defineMark} from '../../shared/lib/marks'
import type {PageArgs} from '../../shared/lib/stories'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Slots.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 */

type DivProps = HTMLAttributes<HTMLDivElement> & {ref?: Ref<HTMLDivElement>}

/** `slots.container` replacing the container outright. */
const FancyContainer = ({ref, ...props}: DivProps) => (
	<div
		{...props}
		ref={ref}
		style={{
			...props.style,
			background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
			color: 'white',
			padding: '20px',
			borderRadius: '16px',
			boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
		}}
	/>
)

/** `StyleMerging`'s container: its own styles merge with whatever `slotProps.container` passes. */
const StyledContainer = ({ref, ...props}: DivProps) => (
	<div {...props} ref={ref} style={{...props.style, background: '#e3f2fd', borderRadius: '8px'}} />
)

/**
 * `WithSlotProps`' harness. It MERGES its handlers into the story's own `slotProps` rather than
 * hardcoding the whole bag, so the story keeps owning the presentational half.
 */
function EventLog({slotProps, ...args}: PageArgs) {
	const [events, setEvents] = useState<string[]>([])
	const addEvent = (event: string) => setEvents(prev => [...prev.slice(-4), event])

	const merged = {
		...slotProps,
		container: {
			...slotProps?.container,
			onKeyDown: (e: KeyboardEvent) => {
				if (e.key === 'Enter') {
					e.preventDefault()
					addEvent('Enter pressed')
				}
			},
			onClick: () => addEvent('Clicked'),
			onFocus: () => addEvent('Focused'),
			onBlur: () => addEvent('Blurred'),
		},
	}

	return (
		<>
			<h3>Styling & Events via slotProps</h3>
			<p>Customize styling and add custom event handlers without replacing components:</p>

			<MarkedInput {...args} slotProps={merged} />

			<div style={{marginTop: '16px', padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '4px'}}>
				<strong>Recent events:</strong>
				{events.length === 0 ? (
					<p style={{marginTop: '8px', color: '#666'}}>No events yet</p>
				) : (
					<ul style={{marginTop: '8px', paddingLeft: '20px'}}>
						{events.map(event => (
							<li key={event}>{event}</li>
						))}
					</ul>
				)}
			</div>
		</>
	)
}

export const fixtures = {
	SimpleMark: defineMark({
		tag: 'mark',
		style: {backgroundColor: '#ffd700', padding: '2px 4px', borderRadius: '3px'},
	}),
	FancyContainer,
	StyledContainer,
	renderEventLog: (args: PageArgs) => <EventLog {...args} />,
}

/**
 * Spec fixture: the `slots.container` replacement. A `<section>` so the spec can tell it from the
 * default `<div>` by its tag — the container IS the editing host, so no id is needed to find it.
 */
export const CustomContainer = ({ref, ...props}: DivProps) => <section {...props} ref={ref} />