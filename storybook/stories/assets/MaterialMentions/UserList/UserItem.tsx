import {Avatar, ListItem, ListItemAvatar, ListItemButton, ListItemText} from '@mui/material'
import {MarkStruct} from 'rc-marked-input'
import {SearchUser} from '../types'

export interface UserItemProps {
    onSelect: (mark: MarkStruct) => void
    user: SearchUser
}

export const UserItem = ({onSelect, user}: UserItemProps) => {
    const abbr = user.login[0]

    return (
        <ListItem disablePadding onClick={() => onSelect({label: user.login, value: user.avatar_url ?? abbr})}>
            <ListItemButton>
                <ListItemAvatar>
                    <Avatar src={user.avatar_url} children={abbr}/>
                </ListItemAvatar>
                <ListItemText primary={user.login}/>
            </ListItemButton>
        </ListItem>
    )
}

