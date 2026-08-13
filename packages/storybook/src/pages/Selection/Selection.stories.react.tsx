import type {MarkProps} from '@markput/react'
import type {Meta, StoryObj} from '@storybook/react-vite'

import {MarkedInputStory} from '../../shared/lib/markedInput.react'

export default {
	title: 'Selection',
	component: MarkedInputStory,
} satisfies Meta<typeof MarkedInputStory>

type Story = StoryObj<typeof MarkedInputStory>

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