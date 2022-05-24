import {Button, ButtonProps} from "./assets/Button";
import {MarkedInput, Option} from "../lib";
import {ElementType, useState} from "react";
import {PlainText} from "./assets/PlainText";
import {getTitle} from "./assets/getTitle";

export default {
    title: getTitle(),
    component: MarkedInput,
    subcomponents: {Option}
}

export const Base = () => {
    const [value, setValue] = useState(
        `Hello beautiful @[first](primary:1) world from the @[second](secondary:2) and @[third](primary:1), and @[fourth](secondary:2)!`
    )

    return (
        <>
            <MarkedInput
                style={{minWidth: 100}}
                spanStyle={{width: 'auto', minWidth: 10}}
                Mark={Button} value={value} onChange={setValue}>
                <Option<ButtonProps>
                    markup="@[__value__](primary:__id__)"
                    initializer={(label, id) => ({label, primary: true, onClick: () => alert(id)})}
                />
                <Option<ButtonProps>
                    markup="@[__value__](secondary:__id__)"
                    initializer={(label, id) => ({label})}
                />
            </MarkedInput>

            <PlainText value={value}/>
        </>
    )
}

export const RichEditor = () => {
    const [value, setValue] = useState(`Can use to simulate rich editor
        <b>Bold text>
        <strong>Important text>
        <i>Italic text>
        <em>Emphasized text>
        <mark>Marked text>
        <small>Smaller text>
        <del>Deleted text>
        <ins>Inserted text>
        <sub>Subscript text>
        <sup>Superscript text>
    `)

    return (
        <>
            <MarkedInput Mark={Tag} value={value} onChange={setValue}>
                <Option markup="<__value__>__id__>" initializer={(as, value) => ({as, value})}/>
            </MarkedInput>

            <PlainText value={value}/>
        </>
    )
}

const Tag = ({as, value}: { as: ElementType, value: string }) => {
    const Component = as
    return <Component>
        {value}
    </Component>
}