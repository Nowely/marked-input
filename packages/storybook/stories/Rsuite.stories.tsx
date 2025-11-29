import type {Meta} from '@storybook/react-vite'
import {MarkedInput, useOverlay} from 'rc-marked-input'
import type {Markup} from 'rc-marked-input'
import {useEffect, useState} from 'react'
import {Input, Popover, Tag} from 'rsuite'
import {Text} from '../components/Text'
import {withStyle} from '../components/withStyle'

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
		<>
			<Input
				as={MarkedInput}
				Mark={Tag as any}
				Overlay={Overlay}
				value={value}
				onChange={(_, value) => setValue(value as unknown as string)}
				options={[
					{
						markup: '@[__value__](common)' as Markup,
						slotProps: {
							mark: ({value}: {value?: string}) => ({children: value}),
						},
					},
				]}
			/>

			<Text label="Plaint text:" value={value} />
		</>
	)
}

export const TaggedInput = () => {
	const [value, setValue] = useState(initialState)
	const classNames = 'rs-picker-tag-wrapper rs-picker-input rs-picker-toggle-wrapper rs-picker-tag'

	return (
		<>
			<MarkedInput
				Mark={Tag}
				Overlay={Overlay}
				value={value}
				onChange={setValue}
				className={classNames}
				style={{
					minHeight: 36,
					paddingRight: 5,
				}}
				options={[
					{
						markup: '@[__value__](common)' as Markup,
						slotProps: {
							mark: ({value}) => ({children: value, style: {marginLeft: 0}}),
						},
					},
				]}
				slotProps={{
					container: {
						onKeyDown: e => e.key === 'Enter' && e.preventDefault(),
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
				}}
			/>

			<br />
			<Text label="Plaint text:" value={value} />
		</>
	)
}
