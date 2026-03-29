import {MarkedInput} from '@markput/vue'
import type {Meta, StoryObj} from '@storybook/vue3-vite'
import {defineComponent, h, ref, reactive} from 'vue'

const meta = {
	title: 'API/Slots',
	component: MarkedInput,
	parameters: {
		docs: {
			description: {
				component:
					'Demonstrates the slots API for customizing internal components. ' +
					'Use `slots` to replace component tag names and `slotProps` to customize their appearance and behavior.',
			},
		},
	},
} satisfies Meta<typeof MarkedInput>

export default meta
type Story = StoryObj<typeof meta>

const SimpleMark = defineComponent({
	props: {value: String, children: {type: null}},
	setup(props, {slots}) {
		return () =>
			h(
				'mark',
				{style: {backgroundColor: '#ffd700', padding: '2px 4px', borderRadius: '3px'}},
				slots.default?.() ?? props.value
			)
	},
})

const EventLogComponent = defineComponent({
	props: {Mark: {type: null}, value: String, className: String},
	setup(props) {
		const currentValue = ref(props.value ?? '')
		const events = reactive<string[]>([])

		const addEvent = (event: string) => {
			if (events.length > 4) events.splice(0, events.length - 4)
			events.push(event)
		}

		return () => [
			h('h3', 'Styling & Events via slotProps'),
			h('p', 'Customize styling and add custom event handlers without replacing components:'),
			h(MarkedInput, {
				Mark: props.Mark ?? SimpleMark,
				value: currentValue.value,
				onChange: (v: string) => {
					currentValue.value = v
				},
				className: props.className,
				slotProps: {
					container: {
						onKeydown: (e: KeyboardEvent) => {
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
				},
			}),
			h('div', {style: {marginTop: '16px', padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '4px'}}, [
				h('strong', 'Recent events:'),
				events.length === 0
					? h('p', {style: {marginTop: '8px', color: '#666'}}, 'No events yet')
					: h(
							'ul',
							{style: {marginTop: '8px', paddingLeft: '20px'}},
							events.map((event, i) => h('li', {key: i}, event))
						),
			]),
		]
	},
})

export const WithSlotProps: Story = {
	args: {Mark: SimpleMark, value: 'Try pressing @[Enter] or clicking', className: 'custom-container'},
	render: () => EventLogComponent,
}

export const StyleMerging: Story = {
	parameters: {plainValue: 'right'},
	args: {
		Mark: SimpleMark,
		value: 'Container has @[merged] styles from multiple sources',
		style: {
			background: '#e3f2fd',
			borderRadius: '8px',
		},
		slotProps: {
			container: {
				style: {
					padding: '16px',
					border: '2px solid #1976d2',
				},
			},
		},
	},
}

export const DataAttributes: Story = {
	parameters: {plainValue: 'right'},
	args: {
		Mark: SimpleMark,
		value: 'Use @[data] attributes for testing and tracking',
		slotProps: {
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
		},
	},
}