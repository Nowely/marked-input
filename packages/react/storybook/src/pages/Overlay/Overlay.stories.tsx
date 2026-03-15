import type {MarkToken} from '@markput/react'
import {MarkedInput, useOverlay} from '@markput/react'
import type {Meta, StoryObj} from '@storybook/react-vite'
import type {RefObject} from 'react'

export default {
	title: 'MarkedInput/Overlay',
	tags: ['autodocs'],
	component: MarkedInput,
}

type Story = StoryObj<Meta<typeof MarkedInput<MarkToken>>>

const Mark = (props: MarkToken) => <mark>{props.value}</mark>

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

const Overlay = () => <h1>I am the overlay</h1>

export const CustomOverlay: Story = {
	args: {
		Mark: () => null,
		Overlay,
		value: 'Hello, custom overlay by trigger @!',
	},
}

export const CustomTrigger: Story = {
	args: {
		Mark: () => null,
		Overlay,
		value: 'Hello, custom overlay by trigger /!',
		options: [{overlay: {trigger: '/'}}],
	},
}

const Tooltip = () => {
	const {style} = useOverlay()
	return <div style={{position: 'absolute', ...style}}>I am the overlay</div>
}

export const PositionedOverlay: Story = {
	args: {
		Mark: () => null,
		Overlay: Tooltip,
		value: 'Hello, positioned overlay by trigger @!',
	},
}

const List = () => {
	const {select, ref} = useOverlay()
	return (
		<ul ref={ref as RefObject<HTMLUListElement>}>
			<li onClick={() => select({value: 'First'})}>Clickable First</li>
			<li onClick={() => select({value: 'Second'})}>Clickable Second</li>
		</ul>
	)
}

export const SelectableOverlay: Story = {
	args: {
		Mark,
		Overlay: List,
		value: 'Hello, suggest overlay by trigger @!',
		options: [{markup: '@[__value__](__meta__)', overlay: {trigger: '@'}}],
	},
}