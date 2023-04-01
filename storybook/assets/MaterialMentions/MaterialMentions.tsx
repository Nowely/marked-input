import {createMarkedInput} from 'lib'
import {Mention} from './Mention'
import {UserList} from './UserList'

export const MaterialMentions = createMarkedInput({Mark: Mention, Overlay: UserList, options: [{
	markup: '@[__label__]',
}]})