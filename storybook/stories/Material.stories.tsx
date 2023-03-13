import {Chip} from "@mui/material"
import {MarkedInput} from "rc-marked-input"
import {useState} from "react"
import {getTitle} from "./assets/getTitle"
import {MaterialMentions} from "./assets/MaterialMentions"
import {Text} from "./assets/Text"

export default {
    title: getTitle("Material"),
    component: MarkedInput,
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
            options={[{
                markup: "@[__label__](outlined:__value__)",
                initMark: ({label}) => ({label, variant: "outlined" as const, size: "small" as const}),
            }, {
                markup: "@[__label__](common:__value__)",
                initMark: ({label}) => ({label, size: "small" as const}),
            }]}
        />

        <Text label="Plaint text:" value={value}/>
    </>
}
