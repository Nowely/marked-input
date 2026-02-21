import type {Meta, StoryObj} from '@storybook/react-vite'
import {MarkedInput} from 'rc-marked-input'
import {forwardRef, useState} from 'react'
import {Text} from '../../shared/components/Text'

const meta = {
	title: 'API/Slots',
	component: MarkedInput,
	parameters: {
		docs: {
			description: {
				component:
					'Demonstrates the slots API for customizing internal components. ' +
					'Use `slots` to replace components and `slotProps` to customize their appearance and behavior.',
			},
		},
	},
} satisfies Meta<typeof MarkedInput>

export default meta
type Story = StoryObj<typeof meta>

const SimpleMark = ({children}: {value?: string; children?: React.ReactNode}) => (
	<mark style={{backgroundColor: '#ffd700', padding: '2px 4px', borderRadius: '3px'}}>{children}</mark>
)

/**
 * Using slots to completely replace container and span components.
 * This is useful when you need full control over the component structure.
 */
export const CustomComponents: Story = {
	render: () => {
		const [value, setValue] = useState('Both @[container] and @[span] are @[customized]')

		const FancyContainer = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
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
		))
		FancyContainer.displayName = 'FancyContainer'

		const FancySpan = forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>((props, ref) => (
			<span
				{...props}
				ref={ref}
				style={{
					...props.style,
					fontFamily: 'Georgia, serif',
					fontSize: '16px',
					letterSpacing: '0.5px',
				}}
			/>
		))
		FancySpan.displayName = 'FancySpan'

		return (
			<>
				<h3>Custom Components via Slots</h3>
				<p>Replace default div/span with your own components:</p>

				<MarkedInput
					Mark={SimpleMark}
					value={value}
					onChange={setValue}
					slots={{
						container: FancyContainer,
						span: FancySpan,
					}}
				/>

				<Text label="Raw value:" value={value} />
			</>
		)
	},
}

/**
 * Using slotProps to customize styling and add event handlers.
 * This is useful when you want to keep the default components but customize their behavior.
 */
export const WithSlotProps: Story = {
	render: () => {
		const [value, setValue] = useState('Try pressing @[Enter] or clicking')
		const [events, setEvents] = useState<string[]>([])

		const addEvent = (event: string) => {
			setEvents(prev => [...prev.slice(-4), event])
		}

		return (
			<>
				<h3>Styling & Events via slotProps</h3>
				<p>Customize styling and add custom event handlers without replacing components:</p>

				<MarkedInput
					Mark={SimpleMark}
					value={value}
					onChange={setValue}
					className="custom-container"
					slotProps={{
						container: {
							onKeyDown: e => {
								if (e.key === 'Enter') {
									e.preventDefault()
									addEvent('Enter pressed')
								}
							},
							onClick: () => addEvent('Clicked'),
							onFocus: () => addEvent('Focused'),
							onBlur: () => addEvent('Blurred'),
							style: {
								border: '2px solid #4CAF50',
								borderRadius: '8px',
								padding: '12px',
								backgroundColor: '#f5f5f5',
							},
						},
						span: {
							style: {
								color: '#333',
								fontSize: '14px',
							},
						},
					}}
				/>

				<div style={{marginTop: '16px', padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '4px'}}>
					<strong>Recent events:</strong>
					{events.length === 0 ? (
						<p style={{marginTop: '8px', color: '#666'}}>No events yet</p>
					) : (
						<ul style={{marginTop: '8px', paddingLeft: '20px'}}>
							{events.map((event, i) => (
								<li key={i}>{event}</li>
							))}
						</ul>
					)}
				</div>

				<Text label="Raw value:" value={value} />
			</>
		)
	},
}

/**
 * Edge case: Style merging when both slots and slotProps provide styles.
 * Shows that slotProps styles take precedence.
 */
export const StyleMerging: Story = {
	render: () => {
		const [value, setValue] = useState('Container has @[merged] styles from multiple sources')

		const StyledContainer = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
			<div
				{...props}
				ref={ref}
				style={{
					...props.style,
					background: '#e3f2fd',
					borderRadius: '8px',
				}}
			/>
		))
		StyledContainer.displayName = 'StyledContainer'

		return (
			<>
				<h3>Style Merging</h3>
				<p>
					When using both slots and slotProps, styles merge intelligently. slotProps styles override slot
					styles:
				</p>

				<MarkedInput
					Mark={SimpleMark}
					value={value}
					onChange={setValue}
					slots={{
						container: StyledContainer,
					}}
					slotProps={{
						container: {
							style: {
								padding: '16px',
								border: '2px solid #1976d2',
							},
						},
					}}
				/>

				<Text label="Raw value:" value={value} />
			</>
		)
	},
}

/**
 * Data attributes support using camelCase notation.
 * React automatically converts camelCase properties like 'dataUserId' to HTML attributes like 'data-user-id'.
 */
export const DataAttributes: Story = {
	render: () => {
		const [value, setValue] = useState('Use @[data] attributes for testing and tracking')

		return (
			<>
				<h3>Data Attributes in camelCase</h3>
				<p>slotProps supports camelCase data attributes (React converts them to kebab-case):</p>

				<MarkedInput
					Mark={SimpleMark}
					value={value}
					onChange={setValue}
					slotProps={{
						container: {
							dataTestId: 'marked-input-demo',
							dataModule: 'slots-api',
							dataUserId: 'user-123',
							style: {
								border: '1px solid #999',
								padding: '12px',
								borderRadius: '4px',
								backgroundColor: '#f9f9f9',
							},
						},
						span: {
							dataTokenType: 'text',
						},
					}}
				/>

				<div style={{marginTop: '16px', padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '4px'}}>
					<p style={{marginTop: 0}}>
						<strong>Try inspecting the element:</strong> You'll see data-test-id, data-module, data-user-id
						attributes on the container. These are automatically converted from camelCase (dataTestId →
						data-test-id).
					</p>
				</div>

				<Text label="Raw value:" value={value} />
			</>
		)
	},
}
