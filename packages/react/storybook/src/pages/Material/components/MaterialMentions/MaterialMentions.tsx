import type {MarkedInputProps, Markup} from '@markput/react'
import {MarkedInput} from '@markput/react'
import {Mention} from './Mention'
import {UserList} from './UserList'

const options = [
	{
		markup: '@[__value__]' as Markup,
		overlay: {trigger: '@'},
	},
]

export const MaterialMentions = (props: Omit<MarkedInputProps, 'Mark' | 'Overlay' | 'options'>) => (
	<MarkedInput Mark={Mention} Overlay={UserList} options={options} {...props} />
)
