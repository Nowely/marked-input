import type {MarkProps, MarkedInputProps, Markup} from '@markput/react'
import {MarkedInput, useOverlay} from '@markput/react'
import type {Meta, StoryObj} from '@storybook/react-vite'
import type {ComponentType} from 'react'
import {useEffect, useState} from 'react'
import {Input, Popover, Tag} from 'rsuite'
import type {TagProps} from 'rsuite'

import {withStyle} from '../../shared/lib/withStyle'

export default {
	title: 'Styled/Rsuite',
	component: MarkedInput,
	decorators: [withStyle('rsuite.min.css')],
} as Meta<typeof MarkedInput>

const Overlay = () => {
	const {style, match, select, close} = useOverlay()

	useEffect(() => {
		const handleEnter = (ev: KeyboardEvent) => {
			if (ev.key === 'Enter') {
				ev.preventDefault()
				select({value: match.value})
				close()
			}
		}

		document.addEventListener('keydown', handleEnter)
		return () => document.removeEventListener('keydown', handleEnter)
	}, [match])

	return (
		<Popover style={style} visible>
			<i>
				{' '}
				Press the <b>'Enter'</b> to create: <b>{`${match.value}`}</b>{' '}
			</i>
		</Popover>
	)
}

const initialState =
	"Type the '@' to begin creating a @[tag](common). Then press the @[Enter](common) to finish. For example: @hello"

export const Overridden = () => {
	const [value, setValue] = useState(initialState)

	return (
		<Input
			as={MarkedInput}
			Mark={Tag as any}
			Overlay={Overlay}
			value={value}
			onChange={(_, value) => setValue(value as unknown as string)}
			options={[
				{
					markup: '@[__value__](common)' as Markup,
					mark: ({value}: {value?: string}) => ({children: value}),
					overlay: {trigger: '@'},
				},
			]}
		/>
	)
}

export const TaggedInput: StoryObj<MarkedInputProps<TagProps>> = {
	args: {
		Mark: Tag as ComponentType<TagProps>,
		Overlay,
		value: initialState,
		className: 'rs-picker-tag-wrapper rs-picker-input rs-picker-toggle-wrapper rs-picker-tag',
		style: {
			minHeight: 36,
			paddingRight: 5,
		},
		options: [
			{
				markup: '@[__value__](common)' as Markup,
				mark: ({value}: MarkProps) => ({children: value, style: {marginLeft: 0}}),
				overlay: {trigger: '@'},
			},
		],
		slotProps: {
			container: {
				onKeyDown: (e: React.KeyboardEvent) => e.key === 'Enter' && e.preventDefault(),
			},
			span: {
				className: 'rs-tag rs-tag-md',
				style: {
					backgroundColor: 'white',
					paddingLeft: 0,
					paddingRight: 0,
					whiteSpace: 'pre-wrap',
					minWidth: 5,
				},
			},
		},
	},
}