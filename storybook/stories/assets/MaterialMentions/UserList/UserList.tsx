import {List, Paper} from '@mui/material'
import {useOverlay} from 'rc-marked-input'
import {SearchUser} from '../types'
import {useFetch} from '../utils/useFetch'
import {UserItem} from './UserItem'

export const UserList = () => {
	const {select, trigger: {value}, style} = useOverlay()
	const [data] = useFetch<{ items: SearchUser[] }>(`https://api.github.com/search/users?q=${value}`, [value])
	const users = data?.items ?? []

	if (users.length === 0) return null

	return (
		<Paper elevation={3}
			   sx={{
				   width: '100%',
				   maxWidth: 280,
				   maxHeight: 260,
				   overflow: 'auto',
				   position: 'absolute',
				   top: style.top
			   }}>
			<List dense>
				{users.map(user => (<UserItem key={user.login} onSelect={select} user={user}/>))}
			</List>
		</Paper>
	)
}