import {Avatar, Chip} from '@mui/material'
import {MarkStruct} from 'rc-marked-input'
import {User} from './types'
import {useFetch} from './utils/useFetch'

export const Mention = ({label}: MarkStruct) => {
	const [user] = useFetch<User>(`https://api.github.com/users/${label}`, [])
	const abbr = getAbbr(user?.name) ?? label[0]

	return <Chip variant="outlined" label={label} size="small"
				 avatar={<Avatar src={user?.avatar_url} children={abbr}/>}/>
}

export const getAbbr = (str?: string, length: number = 3) => str?.split(' ').slice(0, length).map(s => s[0]).join('')