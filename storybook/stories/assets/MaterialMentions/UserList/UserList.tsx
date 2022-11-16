import {OverlayProps} from "rc-marked-input/types/types";
import {List, Paper} from "@mui/material";
import {UserItem} from "./UserItem";
import {useFetch} from "../utils/useFetch";
import {SearchUser} from "../types";

export const UserList = ({onSelect, trigger: {value}, style}: OverlayProps) => {
    const [data] = useFetch<{items: SearchUser[]}>(`https://api.github.com/search/users?q=${value}`, [value])
    const users = data?.items ?? []

    if (users.length === 0) return null

    return (
        <Paper elevation={3}
               sx={{width: '100%', maxWidth: 280, maxHeight: 260, overflow: 'auto', position: 'absolute', top: style.top}}>
            <List dense>
                {users.map(user => (<UserItem key={user.login} onSelect={onSelect} user={user}/>))}
            </List>
        </Paper>
    )
}