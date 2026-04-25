import type {MarkProps, MarkedInputProps} from '@markput/react'
import {MarkedInput} from '@markput/react'
import type {ChipProps} from '@mui/material'
import {Chip, Input} from '@mui/material'
import type {Meta, StoryObj} from '@storybook/react-vite'
import type {ComponentType, ChangeEvent} from 'react'
import {useState} from 'react'

import {MaterialMentions} from './components/MaterialMentions'

export default {
	title: 'Styled/Material',
	component: MarkedInput,
} satisfies Meta<typeof MarkedInput>

export const Mentions = () => {
	const [value, setValue] = useState(`Enter the '@' for calling mention list:\n- Hello @Agustina and @[Ruslan]!`)

	return <MaterialMentions value={value} onChange={setValue} />
}

const initialValue = 'Hello beautiful the @[first](outlined:1) world from the @[second](common:2) '

export const Chipped: StoryObj<MarkedInputProps<ChipProps>> = {
	args: {
		// oxlint-disable-next-line no-unsafe-type-assertion
		Mark: Chip as ComponentType<ChipProps>,
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
		<Input
			// oxlint-disable-next-line no-unsafe-type-assertion
			inputComponent={MarkedInput as ComponentType<MarkedInputProps<ChipProps>>}
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
			onChange={(e: ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
		/>
	)
}