import {Button, ButtonProps} from "./assets/Button";
import {MarkedInput, Option, denote} from "../lib";
import {ElementType, useState} from "react";
import {Text} from "./assets/Text";
import {getTitle} from "./assets/getTitle";

export default {
    title: getTitle(),
    component: MarkedInput,
    subcomponents: {Option}
}

export const Base = () => {
    const primaryMarkup = "@[__value__](primary:__id__)"
    const secondaryMarkup = "@[__value__](secondary:__id__)"

    const [value, setValue] = useState(
        "Enter the '@' for calling @[primary](primary:4) suggestions and '/' for @[secondary](secondary:7)!\n" +
        "Mark is can be a any component with any logic. In this example it is the @[Button](primary:54): clickable primary or secondary.\n" +
        "For found mark used @[annotations](secondary:123). It text also is editable..."
    )

    const displayText = denote(value, mark => mark.value, primaryMarkup, secondaryMarkup)

    return (
        <>
            <MarkedInput
                style={{minWidth: 100}}
                spanStyle={{width: 'auto', minWidth: 10}}
                Mark={Button} value={value} onChange={setValue}>
                <Option<ButtonProps>
                    markup={primaryMarkup}
                    trigger="@"
                    data={["First", "Second", "Third", "Fourth", "Fifth", "Sixth"]}
                    initializer={(label, id) => ({label, primary: true, onClick: () => alert(id)})}
                />
                <Option<ButtonProps>
                    markup={secondaryMarkup}
                    trigger="/"
                    data={["Seventh", "Eight", "Ninth"]}
                    initializer={(label, id) => ({label})}
                />
            </MarkedInput>

            <Text value={value}/>

            <Text label={"Display text:"} value={displayText}/>
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

            <Text value={value}/>
        </>
    )
}

const Tag = ({as, value}: { as: ElementType, value: string }) => {
    const Component = as
    return <Component>
        {value}
    </Component>
}