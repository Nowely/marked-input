import {Avatar, ListItem, ListItemAvatar, ListItemButton, ListItemText} from '@mui/material'
import type {MarkToken} from '@markput/react'
import type {SearchUser} from '../types'

export interface UserItemProps {
	onSelect: (mark: Pick<MarkToken, 'value' | 'meta'>) => void
	user: SearchUser
}

export const UserItem = ({onSelect, user}: UserItemProps) => {
	const abbr = user.login[0]

	return (
		<ListItem disablePadding onClick={() => onSelect({value: user.login, meta: user.avatar_url ?? abbr})}>
			<ListItemButton>
				<ListItemAvatar>
					<Avatar src={user.avatar_url} children={abbr} />
				</ListItemAvatar>
				<ListItemText primary={user.login} />
			</ListItemButton>
		</ListItem>
	)
}
