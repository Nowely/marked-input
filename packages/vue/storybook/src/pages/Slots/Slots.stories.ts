import type {Meta, StoryObj} from '@storybook/vue3-vite'
import {defineComponent, h, ref, reactive} from 'vue'
import {MarkedInput} from '@markput/vue'
import Text from '../../shared/components/Text.vue'

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

export const WithSlotProps: Story = {
	render: () =>
		defineComponent({
			setup() {
				const value = ref('Try pressing @[Enter] or clicking')
				const events = reactive<string[]>([])

				const addEvent = (event: string) => {
					if (events.length > 4) events.splice(0, events.length - 4)
					events.push(event)
				}

				return () => [
					h('h3', 'Styling & Events via slotProps'),
					h('p', 'Customize styling and add custom event handlers without replacing components:'),
					h(MarkedInput, {
						Mark: SimpleMark,
						value: value.value,
						onChange: (v: string) => {
							value.value = v
						},
						className: 'custom-container',
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
					h(
						'div',
						{style: {marginTop: '16px', padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '4px'}},
						[
							h('strong', 'Recent events:'),
							events.length === 0
								? h('p', {style: {marginTop: '8px', color: '#666'}}, 'No events yet')
								: h(
										'ul',
										{style: {marginTop: '8px', paddingLeft: '20px'}},
										events.map((event, i) => h('li', {key: i}, event))
									),
						]
					),
					h(Text, {label: 'Raw value:', value: value.value}),
				]
			},
		}),
}

export const StyleMerging: Story = {
	render: () =>
		defineComponent({
			setup() {
				const value = ref('Container has @[merged] styles from multiple sources')

				return () => [
					h('h3', 'Style Merging'),
					h(
						'p',
						'When using both className/style and slotProps, styles merge intelligently. slotProps styles override component styles:'
					),
					h(MarkedInput, {
						Mark: SimpleMark,
						value: value.value,
						onChange: (v: string) => {
							value.value = v
						},
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
					}),
					h(Text, {label: 'Raw value:', value: value.value}),
				]
			},
		}),
}

export const DataAttributes: Story = {
	render: () =>
		defineComponent({
			setup() {
				const value = ref('Use @[data] attributes for testing and tracking')

				return () => [
					h('h3', 'Data Attributes in camelCase'),
					h('p', 'slotProps supports camelCase data attributes (converted to kebab-case):'),
					h(MarkedInput, {
						Mark: SimpleMark,
						value: value.value,
						onChange: (v: string) => {
							value.value = v
						},
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
					}),
					h(
						'div',
						{style: {marginTop: '16px', padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '4px'}},
						h('p', {style: {marginTop: 0}}, [
							h('strong', 'Try inspecting the element:'),
							" You'll see data-test-id, data-module, data-user-id attributes on the container.",
						])
					),
					h(Text, {label: 'Raw value:', value: value.value}),
				]
			},
		}),
}
