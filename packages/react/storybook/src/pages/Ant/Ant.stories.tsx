import {MarkedInput} from '@markput/react'
import {Tag} from 'antd'
import {useState} from 'react'

import {Text} from '../../shared/components/Text'

export default {
	title: 'Styled/Ant',
	component: MarkedInput,
}

export const Tagged = () => {
	const [value, setValue] = useState(
		`We preset five different colors. You can set color property such as @(success), @(processing), @(error), @(default) and @(warning) to show specific status.`
	)

	return (
		<>
			<MarkedInput
				Mark={Tag}
				value={value}
				onChange={setValue}
				options={[
					{
						markup: '@(__value__)',
						mark: ({value}) => ({children: value, color: value, style: {marginRight: 0}}),
					},
				]}
			/>

			<Text label="Plaint text:" value={value} />
		</>
	)
}