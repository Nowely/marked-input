import type {MarkProps, MarkedInputProps} from '@markput/react'
import {MarkedInput} from '@markput/react'
import type {Meta, StoryObj} from '@storybook/react-vite'
import type {TagProps} from 'antd'
import {Tag} from 'antd'
import type {ComponentType} from 'react'

export default {
	title: 'Styled/Ant',
	component: MarkedInput,
} satisfies Meta<typeof MarkedInput>

export const Tagged: StoryObj<MarkedInputProps<TagProps>> = {
	args: {
		Mark: Tag as ComponentType<TagProps>,
		value: `We preset five different colors. You can set color property such as @(success), @(processing), @(error), @(default) and @(warning) to show specific status.`,
		options: [
			{
				markup: '@(__value__)',
				mark: ({value}: MarkProps) => ({children: value, color: value, style: {marginRight: 0}}),
			},
		],
	},
}