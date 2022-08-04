import {MarkedInput, Option} from "../lib";
import {useState} from "react";
import {Avatar, Chip, Divider, List, ListItem, ListItemAvatar, ListItemText, Typography} from "@mui/material";
import {ChipProps} from "@mui/material/Chip/Chip";
import {Text} from "./assets/Text";
import {getTitleOfStyled} from "./assets/getTitle";
import {OverlayProps} from "../lib/MarkedInput/types";

export default {
    title: getTitleOfStyled("Mui"),
    component: MarkedInput,
    subcomponents: {Option}
}

export const Chipped = () => {
    const [value, setValue] = useState("Hello beautiful the @[first](outlined:1) world from the @[second](common:2)")

    return <>
        <MarkedInput
            Mark={Chip}
            value={value}
            onChange={(val: string) => setValue(val)}
        >
            <Option<ChipProps>
                markup="@[__value__](outlined:__id__)"
                initializer={(label, id) => ({label, variant: "outlined", size: "small"})}
            />
            <Option<ChipProps>
                markup="@[__value__](common:__id__)"
                initializer={(label, id) => ({label, size: "small"})}
            />
        </MarkedInput>

        <Text value={value}/>
    </>
}

export const Mention = () => {
    const [value, setValue] = useState("Hello @[Agustina](A) and @[Frank Parker](FP)")

    return <>
        <MarkedInput
            Mark={Chip}
            value={value}
            onChange={(val: string) => setValue(val)}
            Overlay={AlignItemsList}
        >
            <Option<ChipProps>
                trigger="@"
                markup="@[__value__](__id__)"
                initializer={(label, id) => ({label, avatar: <Avatar>{id}</Avatar>, size: "small"})}
            />
        </MarkedInput>

        <Text value={value}/>
    </>
}

//Component based on https://mui.com/material-ui/react-list/#align-list-items
function AlignItemsList({onSelect}: OverlayProps) {
    return (
        <List sx={{width: '100%', maxWidth: 360, bgcolor: 'background.paper'}}>
            <ListItem alignItems="flex-start" onClick={() => onSelect({value: "Remy Sharp", id: "RS"})}>
                <ListItemAvatar>
                    <Avatar alt="Remy Sharp" children="RS"/>
                </ListItemAvatar>
                <ListItemText
                    primary="Brunch this weekend?"
                    secondary={
                        <>
                            <Typography
                                sx={{display: 'inline'}}
                                component="span"
                                variant="body2"
                                color="text.primary"
                            >
                                Ali Connors
                            </Typography>
                            {" — I'll be in your neighborhood doing errands this…"}
                        </>
                    }
                />
            </ListItem>
            <Divider variant="inset" component="li"/>
            <ListItem alignItems="flex-start" onClick={() => onSelect({value: "Travis Howard", id: "TH"})}>
                <ListItemAvatar>
                    <Avatar alt="Travis Howard" children="TH"/>
                </ListItemAvatar>
                <ListItemText
                    primary="Summer BBQ"
                    secondary={
                        <>
                            <Typography
                                sx={{display: 'inline'}}
                                component="span"
                                variant="body2"
                                color="text.primary"
                            >
                                to Scott, Alex, Jennifer
                            </Typography>
                            {" — Wish I could come, but I'm out of town this…"}
                        </>
                    }
                />
            </ListItem>
            <Divider variant="inset" component="li"/>
            <ListItem alignItems="flex-start" onClick={() => onSelect({value: "Cindy Baker", id: "CB"})}>
                <ListItemAvatar>
                    <Avatar alt="Cindy Baker" children="CB"/>
                </ListItemAvatar>
                <ListItemText
                    primary="Oui Oui"
                    secondary={
                        <>
                            <Typography
                                sx={{display: 'inline'}}
                                component="span"
                                variant="body2"
                                color="text.primary"
                            >
                                Sandra Adams
                            </Typography>
                            {' — Do you have Paris recommendations? Have you ever…'}
                        </>
                    }
                />
            </ListItem>
        </List>
    );
}