import {Avatar, Chip} from '@mui/material'
import type {MarkToken} from 'rc-marked-input'
import type {User} from './types'
import {useFetch} from './utils/useFetch'

export const Mention = ({value}: MarkToken) => {
	const [user] = useFetch<User>(`https://api.github.com/users/${value}`, [])
	const abbr = getAbbr(user?.name) ?? value[0]

	return (
		<Chip
			variant="outlined"
			label={value}
			size="small"
			avatar={<Avatar src={user?.avatar_url} children={abbr} />}
		/>
	)
}

export const getAbbr = (str?: string, length: number = 3) =>
	str
		?.split(' ')
		.slice(0, length)
		.map(s => s[0])
		.join('')
