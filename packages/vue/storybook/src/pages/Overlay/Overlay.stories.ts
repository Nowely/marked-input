import {MarkedInput, useOverlay} from '@markput/vue'
import type {Meta, StoryObj} from '@storybook/vue3-vite'
import {defineComponent, h, type ComponentPublicInstance} from 'vue'

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

const EmptyMark = defineComponent({setup: () => () => null})

export const CustomOverlay: Story = {
	args: {
		Mark: EmptyMark,
		Overlay: CustomOverlayComponent,
		defaultValue: 'Hello, custom overlay by trigger @!',
	},
}

export const CustomTrigger: Story = {
	args: {
		Mark: EmptyMark,
		Overlay: CustomOverlayComponent,
		defaultValue: 'Hello, custom overlay by trigger /!',
		options: [{overlay: {trigger: '/'}}],
	},
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
	args: {
		Mark: EmptyMark,
		Overlay: Tooltip,
		defaultValue: 'Hello, positioned overlay by trigger @!',
	},
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
	args: {
		Mark,
		Overlay: List,
		defaultValue: 'Hello, suggest overlay by trigger @!',
		options: [{markup: '@[__value__](__meta__)' as any, overlay: {trigger: '@'}}],
	},
}