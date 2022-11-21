import {MarkedInput, Option} from "rc-marked-input";
import {useState} from "react";
import {Chip} from "@mui/material";
import {ChipProps} from "@mui/material/Chip/Chip";
import {Text} from "./assets/Text";
import {getTitle} from "./assets/getTitle";
import {MaterialMentions} from "./assets/MaterialMentions";

export default {
    title: getTitle("Material"),
    component: MarkedInput,
    subcomponents: {Option}
}

export const Mentions = () => {
    const [value, setValue] = useState(`Enter the '@' for calling mention list: \n- Hello @Agustina and @[Ruslan]!`)

    return <>
        <MaterialMentions value={value} onChange={setValue}/>

        <Text label="Plaint text:" value={value}/>
    </>
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
