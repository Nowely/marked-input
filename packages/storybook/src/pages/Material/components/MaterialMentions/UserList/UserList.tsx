import {useOverlay} from '@markput/react'
import {List, Paper} from '@mui/material'

import type {SearchUser} from '../types'
import {useFetch} from '../utils/useFetch'
import {UserItem} from './UserItem'

export const UserList = () => {
	const {select, match, style} = useOverlay()
	const matchValue = match?.value
	const [data] = useFetch<{items: SearchUser[]}>(`https://api.github.com/search/users?q=${matchValue}`, [matchValue])
	const users = data?.items ?? []

	if (users.length === 0) return null

	return (
		<Paper
			elevation={3}
			sx={{
				width: '100%',
				maxWidth: 280,
				maxHeight: 260,
				overflow: 'auto',
				position: 'absolute',
				top: style.top,
			}}
		>
			<List dense>
				{users.map(user => (
					<UserItem key={user.login} onSelect={select} user={user} />
				))}
			</List>
		</Paper>
	)
}