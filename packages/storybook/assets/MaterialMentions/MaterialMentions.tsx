import {createMarkedInput} from 'rc-marked-input'
import type {ParserV1Markup} from 'rc-marked-input'
import {Mention} from './Mention'
import {UserList} from './UserList'

export const MaterialMentions = createMarkedInput({
	Mark: Mention,
	Overlay: UserList,
	options: [
		{
			markup: '@[__label__]' as ParserV1Markup,
		},
	],
})
