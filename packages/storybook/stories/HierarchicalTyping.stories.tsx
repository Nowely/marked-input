import {Meta, StoryObj} from '@storybook/react-vite'
import {MarkedInput, Option, OptionWithSlots} from 'rc-marked-input'
import type {MarkProps} from 'rc-marked-input'
import {useState} from 'react'
import {Button, ButtonProps} from '../assets/Button'
import {Text} from '../assets/Text'

const meta = {
	title: 'API/Hierarchical Typing',
	component: MarkedInput,
	parameters: {
		docs: {
			description: {
				component:
					'Demonstrates the hierarchical type inference system for slot components. ' +
					'The type system provides 4-level fallback: option.slots[type] → global Mark/Overlay → defaultComponent → base props. ' +
					'Default types: Option<any, OverlayProps> - flexible mark props, type-safe overlay props.',
			},
		},
	},
} satisfies Meta<typeof MarkedInput>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Type-safe option creation using Option<T> generic.
 * TypeScript validates that slotProps.mark matches ButtonProps.
 */
export const TypeSafeOptions: Story = {
	render: () => {
		const [value, setValue] = useState('Click @primary[button] or @secondary[another] buttons')

		// ✅ Type-safe: TypeScript validates these props match ButtonProps
		const primaryOption: Option<ButtonProps> = {
			markup: '@primary[__value__]',
			slots: {mark: Button},
			slotProps: {
				mark: (markProps: MarkProps) => ({
					label: markProps.value || 'Default',
					primary: true,
					onClick: () => alert(`Clicked: ${markProps.value}`),
				}),
			},
		}

		const secondaryOption: Option<ButtonProps> = {
			markup: '@secondary[__value__]',
			slots: {mark: Button},
			slotProps: {
				mark: (markProps: MarkProps) => ({
					label: markProps.value || 'Default',
					primary: false,
					onClick: () => alert(`Clicked secondary: ${markProps.value}`),
				}),
			},
		}

		return (
			<>
				<h3>Type-Safe Option Creation</h3>
				<p>Using Option&lt;ButtonProps&gt; ensures compile-time type safety:</p>

				<MarkedInput
					value={value}
					onChange={setValue}
					options={[primaryOption, secondaryOption]}
				/>

				<div style={{marginTop: '16px', padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '4px'}}>
					<strong>Type Safety:</strong>
					<ul style={{marginTop: '8px'}}>
						<li>✅ All required props (label) must be provided</li>
						<li>✅ Optional props (primary, onClick) are validated</li>
						<li>✅ Invalid prop names are caught at compile time</li>
						<li>✅ Excellent IDE autocomplete support</li>
					</ul>
				</div>

				<Text label="Raw value:" value={value} />
			</>
		)
	},
}

// Custom components for mixed types demonstration
interface BadgeProps {
	text?: string
	color: 'red' | 'green' | 'blue'
	children?: React.ReactNode
}

const Badge = (props: BadgeProps) => (
	<span
		style={{
			color: 'white',
			backgroundColor: props.color,
			padding: '2px 8px',
			borderRadius: '12px',
			fontSize: '12px',
			fontWeight: 'bold',
		}}
	>
		{props.children || props.text}
	</span>
)

interface LinkProps {
	href: string
	children?: React.ReactNode
}

const Link = (props: LinkProps) => (
	<a
		href={props.href}
		style={{color: '#1976d2', textDecoration: 'underline'}}
		onClick={e => {
			e.preventDefault()
			alert(`Navigate to: ${props.href}`)
		}}
	>
		{props.children}
	</a>
)

/**
 * Multiple options with different component types.
 * Each option is independently type-safe.
 * Note: When mixing different component types, use Option without generics.
 * This uses default types: Option = Option<any, OverlayProps>.
 * - Mark props are flexible (any) for mixing different components
 * - Overlay props are type-safe (OverlayProps)
 */
export const MixedComponentTypes: Story = {
	render: () => {
		const [value, setValue] = useState('Mix @[button], #[badge], and [link](https://example.com)')

		// Using Option without generic parameters = Option<any, OverlayProps> by default
		const buttonOption: Option = {
			markup: '@[__value__]',
			slots: {mark: Button},
			slotProps: {
				mark: {
					label: 'Button',
					primary: true,
					size: 'small',
					onClick: () => alert('Button clicked'),
				},
			},
		}

		const badgeOption: Option = {
			markup: '#[__value__]',
			slots: {mark: Badge},
			slotProps: {
				mark: {
					color: 'green',
				},
			},
		}

		const linkOption: Option = {
			markup: '[__value__](__meta__)',
			slots: {mark: Link},
			slotProps: {
				mark: (markProps: MarkProps) => ({
					href: markProps.meta || '#',
				}),
			},
		}

		return (
			<>
				<h3>Mixed Component Types</h3>
				<p>Each option can use a different component with its own prop types:</p>

				<MarkedInput
					value={value}
					onChange={setValue}
					options={[buttonOption, badgeOption, linkOption]}
				/>

				<div style={{marginTop: '16px', padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '4px'}}>
					<strong>Component Types:</strong>
					<ul style={{marginTop: '8px'}}>
						<li>
							<code>@[...]</code> → Button with ButtonProps
						</li>
						<li>
							<code>#[...]</code> → Badge with BadgeProps
						</li>
						<li>
							<code>[...](url)</code> → Link with LinkProps
						</li>
					</ul>
				</div>

				<Text label="Raw value:" value={value} />
			</>
		)
	},
}

/**
 * Global Mark component with typed options.
 * Options inherit props type from global Mark component.
 */
export const GlobalMarkComponent: Story = {
	render: () => {
		const [value, setValue] = useState('All marks use @[global] Button with different @[styles]')

		return (
			<>
				<h3>Global Mark Component</h3>
				<p>Set a global Mark component and all options inherit its type:</p>

				<MarkedInput<ButtonProps>
					Mark={Button}
					value={value}
					onChange={setValue}
					options={[
						{
							markup: '@[__value__]',
							slotProps: {
								// TypeScript knows this must be ButtonProps
								mark: (markProps: MarkProps) => ({
									label: markProps.value || '',
									primary: true,
									onClick: () => alert(`Global: ${markProps.value}`),
								}),
							},
						},
						{
							markup: '@[__value__]',
							slotProps: {
								mark: {
									label: 'Secondary Global',
									primary: false,
									size: 'medium',
								},
							},
						},
					]}
				/>

				<div style={{marginTop: '16px', padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '4px'}}>
					<strong>Hierarchical Resolution:</strong>
					<ul style={{marginTop: '8px'}}>
						<li>1. Check option.slots.mark (not set here)</li>
						<li>2. Use global Mark component ✅</li>
						<li>3. Use defaultComponent (not applicable)</li>
						<li>4. Fallback to base MarkProps</li>
					</ul>
				</div>

				<Text label="Raw value:" value={value} />
			</>
		)
	},
}

/**
 * Per-option components override global components.
 * Demonstrates the hierarchical type resolution.
 */
export const PerOptionOverrides: Story = {
	render: () => {
		const [value, setValue] = useState('Global @[button] and custom #[badge] components')

		return (
			<>
				<h3>Per-Option Overrides</h3>
				<p>Options can override the global Mark component with their own:</p>

				<MarkedInput
					Mark={Button}
					value={value}
					onChange={setValue}
					options={[
						{
							// Uses global Button
							markup: '@[__value__]',
							slotProps: {
								mark: {
									label: 'Global Button',
									primary: true,
								},
							},
						},
						{
							// Overrides with custom Badge
							markup: '#[__value__]',
							slots: {mark: Badge},
							slotProps: {
								mark: {
									color: 'red',
								},
							},
						},
					]}
				/>

				<div style={{marginTop: '16px', padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '4px'}}>
					<strong>Resolution for each markup:</strong>
					<ul style={{marginTop: '8px'}}>
						<li>
							<code>@[button]</code> → option.slots.mark not set → uses global Button
						</li>
						<li>
							<code>#[badge]</code> → option.slots.mark = Badge → overrides global
						</li>
					</ul>
				</div>

				<Text label="Raw value:" value={value} />
			</>
		)
	},
}

/**
 * Overlay with typed props.
 * Both mark and overlay props are type-safe.
 * Note: OverlayProps is now the default type, so we don't need to specify it explicitly.
 */
export const OverlayWithTyping: Story = {
	render: () => {
		const [value, setValue] = useState('Type @ to trigger overlay with @[suggestions]')

		// Type-safe with default OverlayProps - no need to specify generic parameter!
		const mentionOption: Option<ButtonProps> = {
			markup: '@[__value__]',
			slots: {
				mark: Button,
			},
			slotProps: {
				mark: (markProps: MarkProps) => ({
					label: markProps.value || 'Mention',
					primary: true,
					size: 'small',
				}),
				// TypeScript knows overlay has { trigger?: string; data?: string[] }
				overlay: {
					trigger: '@',
					data: ['Alice', 'Bob', 'Charlie', 'David', 'Eve', 'Frank', 'Grace'],
				},
			},
		}

		return (
			<>
				<h3>Overlay with Typing</h3>
				<p>
					Both mark and overlay components have full type safety. Try typing @ to see suggestions:
				</p>

				<div style={{position: 'relative'}}>
					<MarkedInput value={value} onChange={setValue} options={[mentionOption]} />
				</div>

				<div style={{marginTop: '16px', padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '4px'}}>
					<strong>Default Type Parameters:</strong>
					<ul style={{marginTop: '8px'}}>
						<li>
							<code>Option&lt;ButtonProps&gt;</code> = <code>Option&lt;ButtonProps, OverlayProps&gt;</code>
						</li>
						<li>First parameter: mark component props (ButtonProps)</li>
						<li>Second parameter: overlay props (defaults to OverlayProps)</li>
						<li>OverlayProps includes trigger and data properties</li>
						<li>Type @ to trigger autocomplete overlay</li>
					</ul>
				</div>

				<Text label="Raw value:" value={value} />
			</>
		)
	},
}

/**
 * Automatic type inference for slotProps (NEW!).
 * Types are automatically extracted from components in slots.
 * No manual type parameters needed!
 */
export const AutomaticInference: Story = {
	render: () => {
		const [value, setValue] = useState('Mix @[button], #[badge], and [link](url) with automatic types!')

		// ✨ Automatic inference - no type parameters needed!
		const options: Option[] = [
			{
				markup: '@[__value__]',
				slots: {mark: Button},
				slotProps: {
					// ✅ Automatically inferred as ButtonProps!
					mark: {
						label: 'Auto Button',
						primary: true,
						size: 'small',
						onClick: () => alert('Auto-typed Button!'),
					},
				},
			},
			{
				markup: '#[__value__]',
				slots: {mark: Badge},
				slotProps: {
					// ✅ Automatically inferred as BadgeProps!
					mark: {
						color: 'green',
					},
				},
			},
			{
				markup: '[__value__](__meta__)',
				slots: {mark: Link},
				slotProps: {
					// ✅ Function transformer also infers LinkProps!
					mark: (markProps: MarkProps) => ({
						href: markProps.meta || 'https://example.com',
					}),
				},
			},
		]

		return (
			<>
				<h3>Automatic Type Inference</h3>
				<p>
					✨ <strong>NEW!</strong> Types are automatically extracted from <code>slots</code> components:
				</p>

				<MarkedInput value={value} onChange={setValue} options={options} />

				<div style={{marginTop: '16px', padding: '12px', backgroundColor: '#e8f5e9', borderRadius: '4px'}}>
					<strong>How it works:</strong>
					<ul style={{marginTop: '8px'}}>
						<li>
							<code>slots: {'{'} mark: Button {'}'}</code> → slotProps.mark automatically typed as ButtonProps
						</li>
						<li>
							<code>slots: {'{'} mark: Badge {'}'}</code> → slotProps.mark automatically typed as BadgeProps
						</li>
						<li>
							<code>slots: {'{'} mark: Link {'}'}</code> → slotProps.mark automatically typed as LinkProps
						</li>
						<li>No manual type parameters needed!</li>
						<li>Each option infers independently</li>
					</ul>
				</div>

				<div style={{marginTop: '16px', padding: '12px', backgroundColor: '#fff3cd', borderRadius: '4px'}}>
					<strong>Under the hood:</strong>
					<p style={{marginTop: '8px', marginBottom: 0}}>
						Uses the <strong>never-sentinel pattern</strong>: When <code>TSlotMarkProps = never</code>{' '}
						(default), TypeScript automatically extracts props from the component in <code>slots.mark</code>
						.
					</p>
				</div>

				<Text label="Raw value:" value={value} />
			</>
		)
	},
}

/**
 * Slot-specific typing for mixed component arrays.
 * Each option can have its own slot types using OptionWithSlots<T> helper.
 * This solves the problem of mixing different component types in the same options array.
 */
export const SlotSpecificTyping: Story = {
	render: () => {
		const [value, setValue] = useState('Mix @[button], #[badge], and [link](url) with full type safety!')

		// ✅ Each option has its own slot-specific type (explicit)
		const buttonOption: OptionWithSlots<ButtonProps> = {
			markup: '@[__value__]',
			slots: {mark: Button},
			slotProps: {
				mark: {
					label: 'Typed Button',
					primary: true,
					size: 'small',
					onClick: () => alert('Button clicked'),
				},
			},
		}

		const badgeOption: OptionWithSlots<BadgeProps> = {
			markup: '#[__value__]',
			slots: {mark: Badge},
			slotProps: {
				mark: {
					color: 'blue',
					// text is optional since we use children
				},
			},
		}

		const linkOption: OptionWithSlots<LinkProps> = {
			markup: '[__value__](__meta__)',
			slots: {mark: Link},
			slotProps: {
				mark: (markProps: MarkProps) => ({
					href: markProps.meta || 'https://example.com',
					// children will be provided by Piece component
				}),
			},
		}

		return (
			<>
				<h3>Slot-Specific Typing</h3>
				<p>
					Using <code>OptionWithSlots&lt;T&gt;</code> helper for per-option type safety:
				</p>

				<MarkedInput
					value={value}
					onChange={setValue}
					options={[buttonOption, badgeOption, linkOption] as Option[]}
				/>

				<div style={{marginTop: '16px', padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '4px'}}>
					<strong>How it works:</strong>
					<ul style={{marginTop: '8px'}}>
						<li>
							<code>OptionWithSlots&lt;ButtonProps&gt;</code> = <code>Option&lt;any, OverlayProps, ButtonProps, OverlayProps&gt;</code>
						</li>
						<li>Each option independently type-checked with its own slot types</li>
						<li>Mix Button, Badge, Link in the same array without type conflicts</li>
						<li>Full autocomplete for each option's slotProps</li>
					</ul>
				</div>

				<div style={{marginTop: '16px', padding: '12px', backgroundColor: '#e8f5e9', borderRadius: '4px'}}>
					<strong>✨ New Feature:</strong>
					<p style={{marginTop: '8px', marginBottom: 0}}>
						The 4-generic-parameter system allows per-option type safety:
						<br />
						<code>Option&lt;TMarkProps, TOverlayProps, TSlotMarkProps, TSlotOverlayProps&gt;</code>
						<br />
						<br />
						<strong>TSlotMarkProps</strong> and <strong>TSlotOverlayProps</strong> provide slot-specific typing
						that overrides global types for maximum flexibility.
					</p>
				</div>

				<Text label="Raw value:" value={value} />
			</>
		)
	},
}

/**
 * Documentation of type safety features.
 * Shows what would cause TypeScript errors.
 */
export const TypeSafetyDocumentation: Story = {
	render: () => {
		return (
			<>
				<h3>Type Safety Features</h3>
				<p>The hierarchical type system catches errors at compile time:</p>

				<div style={{padding: '16px', backgroundColor: '#f0f0f0', borderRadius: '4px'}}>
					<h4 style={{marginTop: 0}}>Examples of Caught Errors:</h4>

					<div style={{marginBottom: '16px'}}>
						<strong>❌ Missing required props:</strong>
						<pre
							style={{
								backgroundColor: '#fff',
								padding: '12px',
								borderRadius: '4px',
								border: '1px solid #ddd',
								marginTop: '8px',
								overflow: 'auto',
							}}
						>
							{`const option: Option<ButtonProps> = {
  markup: '@[__value__]',
  slots: {mark: Button},
  slotProps: {
    mark: {
      primary: true
      // ❌ Error: Property 'label' is missing
    }
  }
}`}
						</pre>
					</div>

					<div style={{marginBottom: '16px'}}>
						<strong>❌ Invalid prop types:</strong>
						<pre
							style={{
								backgroundColor: '#fff',
								padding: '12px',
								borderRadius: '4px',
								border: '1px solid #ddd',
								marginTop: '8px',
								overflow: 'auto',
							}}
						>
							{`const option: Option<ButtonProps> = {
  markup: '@[__value__]',
  slots: {mark: Button},
  slotProps: {
    mark: {
      label: 'Button',
      size: 'extra-large'
      // ❌ Error: '"extra-large"' is not assignable
      // to type '"small" | "medium" | "large"'
    }
  }
}`}
						</pre>
					</div>

					<div style={{marginBottom: '16px'}}>
						<strong>❌ Unknown props:</strong>
						<pre
							style={{
								backgroundColor: '#fff',
								padding: '12px',
								borderRadius: '4px',
								border: '1px solid #ddd',
								marginTop: '8px',
								overflow: 'auto',
							}}
						>
							{`const option: Option<ButtonProps> = {
  markup: '@[__value__]',
  slots: {mark: Button},
  slotProps: {
    mark: {
      label: 'Button',
      invalidProp: 'value'
      // ❌ Error: Object literal may only specify known properties
    }
  }
}`}
						</pre>
					</div>

					<div>
						<strong>✅ All of these errors are caught before runtime!</strong>
					</div>
				</div>

				<div style={{marginTop: '16px', padding: '12px', backgroundColor: '#e3f2fd', borderRadius: '4px'}}>
					<h4 style={{marginTop: 0}}>Benefits:</h4>
					<ul>
						<li>🛡️ Type-safe props for mark and overlay components</li>
						<li>🔍 Excellent IDE autocomplete and IntelliSense</li>
						<li>🚨 Compile-time error detection</li>
						<li>📚 Self-documenting code with explicit types</li>
						<li>🔄 Hierarchical resolution with 4-level fallback</li>
						<li>♻️ Reduced code duplication via helper types</li>
					</ul>
				</div>
			</>
		)
	},
}
