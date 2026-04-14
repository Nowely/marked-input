import type {MarkProps} from '@markput/react'
import {MarkedInput} from '@markput/react'
import type {Meta, StoryObj} from '@storybook/react-vite'

export default {
	title: 'Selection',
	component: MarkedInput,
} satisfies Meta<typeof MarkedInput>

type Story = StoryObj<typeof MarkedInput>

export const Inline: Story = {
	args: {
		Mark: ({value}: MarkProps) => <mark data-testid="mark">{value}</mark>,
		defaultValue: 'hello @[world](1) foo',
	},
}

export const Drag: Story = {
	args: {
		layout: 'block',
		draggable: true,
		Mark: ({value}: MarkProps) => <mark data-testid="mark">{value}</mark>,
		defaultValue: 'hello\n@[world](1)\nfoo',
	},
}