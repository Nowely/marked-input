import type {MarkProps} from '@markput/react'
import {MarkedInput} from '@markput/react'
import type {HTMLAttributes, KeyboardEvent, Ref} from 'react'
import {useState} from 'react'

import type {PageArgs} from '../../shared/lib/stories'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Slots.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 */

type DivProps = HTMLAttributes<HTMLDivElement> & {ref?: Ref<HTMLDivElement>}

const SimpleMark = ({children}: MarkProps) => (
	<mark style={{backgroundColor: '#ffd700', padding: '2px 4px', borderRadius: '3px'}}>{children}</mark>
)

/** `slots.container` replacing the container outright — React-only, see `Slots.stories.react.tsx`. */
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
	SimpleMark,
	/** Only `Slots.stories.react.tsx` reads this; the Vue catalog has no counterpart. */
	FancyContainer,
	renderEventLog: (args: PageArgs) => <EventLog {...args} />,
}

/** Spec fixture: the mark the shared spec mounts everywhere. */
export const marks = {
	Children: ({children}: MarkProps) => <mark>{children}</mark>,
}

/** Spec fixtures: `slots.container` replacements. */
export const containers = {
	Testid: ({ref, ...props}: DivProps) => <div {...props} ref={ref} data-testid="custom-container" />,
	Plain: ({ref, ...props}: DivProps) => <div {...props} ref={ref} />,
}

/** Spec fixtures: `Span` replacements. */
export const spans = {
	Testid: ({value}: MarkProps) => <span data-testid="custom-span">{value}</span>,
	Classy: ({value}: MarkProps) => <span className="custom-span-class">{value}</span>,
	Styled: ({value}: MarkProps) => <span style={{fontWeight: 'bold', fontSize: '16px'}}>{value}</span>,
	SpanProp: ({value}: MarkProps) => (
		<span data-testid="custom-span" data-span-prop="span">
			{value}
		</span>
	),
	Children: ({children}: MarkProps) => <span data-testid="custom-editable-span">{children}</span>,
	TextTestid: ({value}: MarkProps) => <span data-testid="text-span">{value}</span>,
}

/**
 * The `slotProps.container` keys the two adapters spell differently. React's synthetic
 * `onFocus`/`onBlur` bubble, so it needs no capture-phase pair; Vue binds the native events,
 * which do not, and takes `onFocusin`/`onFocusout` instead.
 */
export const eventProps = {
	keyDown: 'onKeyDown',
	focus: 'onFocus',
	blur: 'onBlur',
} as const

/** The OUTER class arg — `className` here, `class` in Vue. */
export const outerClass = (name: string) => ({className: name})

/**
 * An object ref for `slotProps.container.ref`: React's is `{current}`, Vue's is a `Ref`. The
 * reader is what the shared spec asserts on.
 */
export function containerRef() {
	const ref: {current: HTMLElement | null} = {current: null}
	return {ref, current: () => ref.current}
}