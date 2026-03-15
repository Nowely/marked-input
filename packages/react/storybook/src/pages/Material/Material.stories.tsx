import type {MarkProps} from '@markput/react'
import {MarkedInput} from '@markput/react'
import {Chip, Input} from '@mui/material'
import type {Meta, StoryObj} from '@storybook/react-vite'
import type {ComponentType} from 'react'
import {useState} from 'react'

import {Text} from '../../shared/components/Text'
import {MaterialMentions} from './components/MaterialMentions'

export default {
	title: 'Styled/Material',
	component: MarkedInput,
} satisfies Meta<typeof MarkedInput>

type Story = StoryObj<typeof MarkedInput>

export const Mentions = () => {
	const [value, setValue] = useState(`Enter the '@' for calling mention list: \n- Hello @Agustina and @[Ruslan]!`)

	return (
		<>
			<MaterialMentions value={value} onChange={setValue} />

			<Text label="Plaint text:" value={value} />
		</>
	)
}

const initialValue = 'Hello beautiful the @[first](outlined:1) world from the @[second](common:2) '

export const Chipped: Story = {
	args: {
		Mark: Chip as ComponentType<any>,
		value: initialValue,
		options: [
			{
				markup: '@[__value__](outlined:__meta__)',
				mark: ({value}: MarkProps) => ({label: value, variant: 'outlined' as const, size: 'small' as const}),
			},
			{
				markup: '@[__value__](common:__meta__)',
				mark: ({value}: MarkProps) => ({label: value, size: 'small' as const}),
			},
		],
	},
}

export const Overridden = () => {
	const [value, setValue] = useState(initialValue)

	return (
		<>
			<Input
				inputComponent={MarkedInput as any}
				inputProps={{
					Mark: Chip,
					options: [
						{
							markup: '@[__value__](outlined:__meta__)',
							mark: ({value}: MarkProps) => ({
								label: value,
								variant: 'outlined' as const,
								size: 'small' as const,
							}),
						},
						{
							markup: '@[__value__](common:__meta__)',
							mark: ({value}: MarkProps) => ({label: value, size: 'small' as const}),
						},
					],
				}}
				value={value}
				onChange={setValue as any}
			/>

			<br />
			<Text label="Plaint text:" value={value} />
		</>
	)
}