import {MarkedInput, Option} from "../lib";
import {useState} from "react";
import 'antd/dist/antd.css';
import {Tag} from "antd";
import {TagProps} from "antd/lib/tag";
import {Text} from "./assets/Text";
import {getTitleOfStyled} from "./assets/getTitle";

export default {
    title: getTitleOfStyled("Ant design"),
    component: MarkedInput,
    subcomponents: {Option}
}

export const Tagged = () => {
    const [value, setValue] = useState(
        `We preset five different colors. You can set color property such as @(success), @(processing), @(error), @(default) and @(warning) to show specific status.`
    )

    return <>
        <MarkedInput Mark={Tag} value={value} onChange={setValue}>
            <Option<TagProps>
                markup="@(__label__)"
                initializer={(value) => ({children: value, color: value, style: {marginRight: 0}})}
            />
        </MarkedInput>

        <Text value={value}/>
    </>
}