import {Button} from "./assets/Button";
import {MarkedInput, Option, denote, createMarkedInput} from "rc-marked-input";
import {ElementType, useState} from "react";
import {Text} from "./assets/Text";
import {getTitle} from "./assets/getTitle";
import {Markup} from "rc-marked-input/MarkedInput/types";

export default {
    title: getTitle(),
    component: MarkedInput,
    subcomponents: {Option}
}

const Mark = (props: any) => <mark onClick={_ => alert(props.value)}>{props.label}</mark>

export const Marked = () => {
    const [value, setValue] = useState("Hello, clickable marked @[world](Hello! Hello!)!")
    return <MarkedInput Mark={Mark} value={value} onChange={setValue}/>
}


const primaryMarkup: Markup = "@[__label__](primary:__value__)"
const secondaryMarkup: Markup = "@[__label__](secondary:__value__)"

const MarkedInput1 = createMarkedInput(Button, [{
    markup: "@[__label__](primary:__value__)",
    data: ["First", "Second", "Third", "Fourth", "Fifth", "Sixth"],
    initMark: ({label, value}) => ({label, primary: true, onClick: () => alert(value)})
}, {
    markup: "@[__label__](secondary:__value__)",
    trigger: "/",
    data: ["Seventh", "Eight", "Ninth"],
    initMark: ({label}) => ({label})
}]);

export const Base = () => {
    const [value, setValue] = useState(
        "Enter the '@' for calling @[primary](primary:4) suggestions and '/' for @[secondary](secondary:7)!\n" +
        "Mark is can be a any component with any logic. In this example it is the @[Button](primary:54): clickable primary or secondary.\n" +
        "For found mark used @[annotations](secondary:123). It text also is editable..."
    )

    const displayText = denote(value, mark => mark.label, primaryMarkup, secondaryMarkup)

    return (
        <>
            <MarkedInput1
                style={{minWidth: 100}} spanStyle={{width: 'auto', minWidth: 10}}
                value={value} onChange={setValue}
            />

            <Text label="Plaint text:" value={value}/>
            <Text label="Display text (denoted):" value={displayText}/>
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
                <Option markup="<__label__>__value__>" initMark={({label, value}) => ({as: label, value})}/>
            </MarkedInput>

            <Text label="Plaint text:" value={value}/>
        </>
    )
}

const Tag = ({as, value}: { as: ElementType, value: string }) => {
    const Component = as
    return <Component>
        {value}
    </Component>
}