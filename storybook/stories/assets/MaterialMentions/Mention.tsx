import {Mark} from "rc-marked-input";
import {Avatar, Chip} from "@mui/material";
import {useFetch} from "./utils/useFetch";
import {User} from "./types";

export const Mention = ({label}: Mark) => {
    const [user] = useFetch<User>(`https://api.github.com/users/${label}`, [])
    const abbr = getAbbr(user?.name) ?? label[0]

    return <Chip variant="outlined" label={label} size="small" avatar={<Avatar src={user?.avatar_url} children={abbr}/>}/>
}

export const getAbbr = (str?: string, length: number = 3) => str?.split(' ').slice(0, length).map(s => s[0]).join('')