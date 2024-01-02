import {Chip, Input} from '@mui/material'
import {MarkedInput, MarkStruct} from 'rc-marked-input'
import {useState} from 'react'
import {MaterialMentions} from '../assets/MaterialMentions'
import {Text} from '../assets/Text'

export default {
	title: 'Styled/Material',
	component: MarkedInput,
}

export const Mentions = () => {
	const [value, setValue] = useState(`Enter the '@' for calling mention list: \n- Hello @Agustina and @[Ruslan]!`)

	return <>
		<MaterialMentions value={value} onChange={setValue}/>

		<Text label="Plaint text:" value={value}/>
	</>
}

const initialValue = 'Hello beautiful the @[first](outlined:1) world from the @[second](common:2) '

export const Chipped = () => {
	const [value, setValue] = useState(initialValue)

	return <>
		<MarkedInput
			Mark={Chip}
			value={value}
			onChange={setValue}
			options={[{
				markup: '@[__label__](outlined:__value__)',
				initMark: ({label}) => ({label, variant: 'outlined' as const, size: 'small' as const}),
			}, {
				markup: '@[__label__](common:__value__)',
				initMark: ({label}) => ({label, size: 'small' as const}),
			}]}
		/>

		<Text label="Plaint text:" value={value}/>
	</>
}

export const Overridden = () => {
	const [value, setValue] = useState(initialValue)

	return <>
		<Input
			inputComponent={MarkedInput as any}
			inputProps={{
				Mark: Chip,
				options: [{
					markup: '@[__label__](outlined:__value__)',
					initMark: ({label}: MarkStruct) => ({label, variant: 'outlined' as const, size: 'small' as const}),
				}, {
					markup: '@[__label__](common:__value__)',
					initMark: ({label}: MarkStruct) => ({label, size: 'small' as const}),
				}]
			}}
			value={value}
			onChange={setValue as any}
		/>

		<br/>
		<Text label="Plaint text:" value={value}/>
	</>
}