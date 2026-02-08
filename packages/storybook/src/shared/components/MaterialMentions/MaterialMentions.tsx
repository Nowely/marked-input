import type {MarkedInputProps} from 'rc-marked-input'
import {MarkedInput} from 'rc-marked-input'
import type {Markup} from 'rc-marked-input'
import {Mention} from './Mention'
import {UserList} from './UserList'

const options = [
	{
		markup: '@[__value__]' as Markup,
	},
]

export const MaterialMentions = (props: Omit<MarkedInputProps, 'Mark' | 'Overlay' | 'options'>) => (
	<MarkedInput Mark={Mention} Overlay={UserList} options={options} {...props} />
)
