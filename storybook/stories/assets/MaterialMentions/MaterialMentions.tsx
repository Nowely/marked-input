import {createMarkedInput} from 'rc-marked-input'
import {Mention} from './Mention'
import {UserList} from './UserList'

export const MaterialMentions = createMarkedInput(Mention, UserList, [{
    markup: '@[__label__]',
}])