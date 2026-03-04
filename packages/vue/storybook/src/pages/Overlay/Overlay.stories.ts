import type {Meta, StoryObj} from '@storybook/vue3-vite'
import {defineComponent, h, ref, type ComponentPublicInstance} from 'vue'
import {MarkedInput, useOverlay} from '@markput/vue'

export default {
	title: 'MarkedInput/Overlay',
	tags: ['autodocs'],
	component: MarkedInput,
} satisfies Meta<typeof MarkedInput>

type Story = StoryObj<Meta<typeof MarkedInput>>

const Mark = defineComponent({
	props: {value: String},
	setup(props) {
		return () => h('mark', props.value)
	},
})

export const DefaultOverlay: Story = {
	args: {
		Mark,
		defaultValue: 'Hello, default - suggestion overlay by trigger @!',
		options: [
			{
				overlay: {
					trigger: '@',
					data: ['First', 'Second', 'Third'],
				},
			},
		],
	},
}

const CustomOverlayComponent = defineComponent({
	setup() {
		return () => h('h1', 'I am the overlay')
	},
})

export const CustomOverlay: Story = {
	render: () =>
		defineComponent({
			setup() {
				const value = ref('Hello, custom overlay by trigger @!')
				return () =>
					h(MarkedInput, {
						Mark: defineComponent({setup: () => () => null}),
						Overlay: CustomOverlayComponent,
						value: value.value,
						onChange: (v: string) => {
							value.value = v
						},
					})
			},
		}),
}

export const CustomTrigger: Story = {
	render: () =>
		defineComponent({
			setup() {
				const value = ref('Hello, custom overlay by trigger /!')
				return () =>
					h(MarkedInput, {
						Mark: defineComponent({setup: () => () => null}),
						Overlay: CustomOverlayComponent,
						value: value.value,
						onChange: (v: string) => {
							value.value = v
						},
						options: [{overlay: {trigger: '/'}}],
					})
			},
		}),
}

const Tooltip = defineComponent({
	setup() {
		const {style} = useOverlay()
		return () =>
			h(
				'div',
				{
					style: {
						position: 'absolute',
						left: style.value.left,
						top: style.value.top,
					},
				},
				'I am the overlay'
			)
	},
})

export const PositionedOverlay: Story = {
	render: () =>
		defineComponent({
			setup() {
				const value = ref('Hello, positioned overlay by trigger @!')
				return () =>
					h(MarkedInput, {
						Mark: defineComponent({setup: () => () => null}),
						Overlay: Tooltip,
						value: value.value,
						onChange: (v: string) => {
							value.value = v
						},
					})
			},
		}),
}

const List = defineComponent({
	setup() {
		const {select, ref: overlayRef} = useOverlay()
		return () =>
			h(
				'ul',
				{
					ref: (el: Element | ComponentPublicInstance | null) => {
						overlayRef.current = el as HTMLElement | null
					},
				},
				[
					h('li', {onClick: () => select({value: 'First'})}, 'Clickable First'),
					h('li', {onClick: () => select({value: 'Second'})}, 'Clickable Second'),
				]
			)
	},
})

export const SelectableOverlay: Story = {
	render: () =>
		defineComponent({
			setup() {
				const value = ref('Hello, suggest overlay by trigger @!')
				return () =>
					h(MarkedInput, {
						Mark,
						Overlay: List,
						value: value.value,
						onChange: (v: string) => {
							value.value = v
						},
						options: [{markup: '@[__value__](__meta__)' as any, overlay: {trigger: '@'}}],
					})
			},
		}),
}
