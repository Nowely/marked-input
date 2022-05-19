import {MarkedInput, Option} from "../src";
import {useState} from "react";
import {Chip} from "@mui/material";
import {ChipProps} from "@mui/material/Chip/Chip";

export default {component: MarkedInput, subcomponents: {Option}}

export const Mui = () => {
    const [value, setValue] = useState("Hello beautiful the @[first](outlined:1) world from the @[second](common:2)")
    const classNames = ""

    return <>
        <MarkedInput
            /*className={classNames}
            style={{
                minHeight: 36
            }}
            spanClassName="rs-tag rs-tag-md"
            spanStyle={{
                backgroundColor: "white",
                paddingLeft: 0,
                paddingRight: 0
            }}*/
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

        <br/>
        <br/>
        <textarea style={{width: '45%'}} value={value} onChange={event => setValue(event.target.value)}/>
    </>
}