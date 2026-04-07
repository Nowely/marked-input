import type {MarkProps} from '@markput/react'
import {MarkedInput} from '@markput/react'
import type {Meta, StoryObj} from '@storybook/react-vite'
import {useState} from 'react'

export default {
	title: 'Clipboard',
	component: MarkedInput,
} satisfies Meta<typeof MarkedInput>

type Story = StoryObj<typeof MarkedInput>

export const Inline: Story = {
	args: {
		Mark: ({value}: MarkProps) => <mark data-testid="mark">{value}</mark>,
		defaultValue: 'hello @[world](1) foo',
	},
}

function PlainTextInput() {
	const [value, setValue] = useState('abc')
	return (
		<MarkedInput
			Mark={({value}: MarkProps) => <mark data-testid="mark">{value}</mark>}
			value={value}
			onChange={setValue}
		/>
	)
}

export const PlainText: Story = {
	render: () => <PlainTextInput />,
}

export const Drag: Story = {
	args: {
		drag: true,
		Mark: ({value}: MarkProps) => <mark data-testid="mark">{value}</mark>,
		defaultValue: 'hello\n@[world](1)\nfoo',
	},
}

/** Mark component with nested HTML producing multiple text nodes inside the mark element. */
function NestedMark({value}: MarkProps) {
	const mid = Math.ceil(value.length / 2)
	return (
		<mark data-testid="mark">
			<strong>{value.slice(0, mid)}</strong>
			<em>{value.slice(mid)}</em>
		</mark>
	)
}

export const NestedMarkStory: Story = {
	args: {
		Mark: NestedMark,
		defaultValue: 'hello @[world](1) foo',
	},
}