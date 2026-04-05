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