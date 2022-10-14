import {MarkedInput, Option} from "rc-marked-input";
import {useState} from "react";
import {Avatar, Chip, Divider, List, ListItem, ListItemAvatar, ListItemText, Typography} from "@mui/material";
import {ChipProps} from "@mui/material/Chip/Chip";
import {Text} from "./assets/Text";
import {getTitle} from "./assets/getTitle";
import {OverlayProps} from "rc-marked-input/types";

export default {
    //title: getTitle("Material"),
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
                markup="@[__label__](outlined:__value__)"
                initMark={({label}) => ({label, variant: "outlined", size: "small"})}
            />
            <Option<ChipProps>
                markup="@[__label__](common:__value__)"
                initMark={({label}) => ({label, size: "small"})}
            />
        </MarkedInput>

        <Text label="Plaint text:" value={value}/>
    </>
}

export const Mention = () => {
    const [value, setValue] = useState(
        `Enter the '@' for calling mention list: \n- Hello @[Agustina](A) and @[Frank Parker](FP)!`
    )

    return <>
        <MarkedInput
            Mark={Chip}
            value={value}
            onChange={(val: string) => setValue(val)}
            Overlay={AlignItemsList}
        >
            <Option<ChipProps>
                initMark={({label, value}) => ({label, avatar: <Avatar>{value}</Avatar>, size: "small"})}
            />
        </MarkedInput>

        <Text label="Plaint text:" value={value}/>
    </>
}

//Component based on https://mui.com/material-ui/react-list/#align-list-items
function AlignItemsList({onSelect}: OverlayProps) {
    return (
        <List sx={{width: '100%', maxWidth: 360, bgcolor: 'background.paper'}}>
            <ListItem alignItems="flex-start" onClick={() => onSelect({label: "Remy Sharp", value: "RS"})}>
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
            <ListItem alignItems="flex-start" onClick={() => onSelect({label: "Travis Howard", value: "TH"})}>
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
            <ListItem alignItems="flex-start" onClick={() => onSelect({label: "Cindy Baker", value: "CB"})}>
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