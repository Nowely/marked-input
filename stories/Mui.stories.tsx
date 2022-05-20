import {MarkedInput, Option} from "../lib";
import {useState} from "react";
import {Chip} from "@mui/material";
import {ChipProps} from "@mui/material/Chip/Chip";
import {PlainText} from "./assets/PlainText";
import {getTitleOfStyled} from "./assets/getTitle";

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

        <PlainText value={value}/>
    </>
}