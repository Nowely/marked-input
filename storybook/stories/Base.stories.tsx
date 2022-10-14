import {Button} from "./assets/Button";
import {createMarkedInput, denote, MarkedInput, Option} from "rc-marked-input";
import {createElement, useState} from "react";
import {Text} from "./assets/Text";
import {MarkProps, Markup} from "rc-marked-input/types";
import {Meta} from "@storybook/react";

export default {
    //title: getTitle(),
    component: MarkedInput,
    subcomponents: {Option}
} as Meta<typeof MarkedInput>;

const Mark = (props: MarkProps) => <mark onClick={_ => alert(props.value)}>{props.label}</mark>

export const Marked = () => {
    const [value, setValue] = useState("Hello, clickable marked @[world](Hello! Hello!)!")
    return <MarkedInput Mark={Mark} value={value} onChange={setValue}/>
}


const Primary: Markup = "@[__label__](primary:__value__)"
const Default: Markup = "@[__label__](default:__value__)"

const ConfiguredMarkedInput = createMarkedInput(Button, [{
    markup: Primary,
    data: ["First", "Second", "Third", "Fourth", "Fifth", "Sixth"],
    initMark: ({label, value}) => ({label, primary: true, onClick: () => alert(value)})
}, {
    markup: Default,
    trigger: "/",
    data: ["Seventh", "Eight", "Ninth"],
    initMark: ({label}) => ({label})
}]);

const style = {minWidth: 100}
const spanStyle = {width: 'auto', minWidth: 10}

export const Configured = () => {
    const [value, setValue] = useState(
        "Enter the '@' for calling @[primary](primary:4) suggestions and '/' for @[default](default:7)!\n" +
        "Mark is can be a any component with any logic. In this example it is the @[Button](primary:54): clickable primary or secondary.\n" +
        "For found mark used @[annotations](default:123)."
    )

    const displayText = denote(value, mark => mark.label, Primary, Default)

    return (
        <>
            <ConfiguredMarkedInput
                style={style} spanStyle={spanStyle}
                value={value} onChange={setValue}
            />

            <Text label="Plaint text:" value={value}/>
            <Text label="Display text (denoted):" value={displayText}/>
        </>
    )
}

export const Configured1 = () => {
    const [value, setValue] = useState(
        "Enter the '@' for calling @[primary](primary:4) suggestions and '/' for @[default](default:7)!\n" +
        "Mark is can be a any component with any logic. In this example it is the @[Button](primary:54): clickable primary or secondary.\n" +
        "For found mark used @[annotations](default:123)."
    )

    const displayText = denote(value, mark => mark.label, Primary, Default)

    return (
        <>
            <MarkedInput
                Mark={Button}
                style={style} spanStyle={spanStyle}
                value={value} onChange={setValue}
            >
                <Option
                    markup={Primary}
                    data={["First", "Second", "Third", "Fourth", "Fifth", "Sixth"]}
                    initMark={({label, value}) => ({label, primary: true, onClick: () => alert(value)})}
                />
                <Option
                    markup={Default}
                    trigger="/"
                    data={["Seventh", "Eight", "Ninth"]}
                    initMark={({label}) => ({label})}
                />
            </MarkedInput>

            <Text label="Plaint text:" value={value}/>
            <Text label="Display text (denoted):" value={displayText}/>
        </>
    )
}
const Data = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth"]
const AnotherData = ["Seventh", "Eight", "Ninth"]
const Primary1: Markup = "@[__label__](primary:__value__)"
const Default1: Markup = "@[__label__](default)"
export const App = () => {
    const [value, setValue] = useState(
        "Enter the '@' for creating @[Primary Mark](primary:Hello!) or '/' for @[Default mark](default)!"
    )

    return (
        <MarkedInput Mark={Button} value={value} onChange={setValue}>
            <Option
                markup={Primary1}
                data={Data}
                initMark={({label, value}) => ({label, primary: true, onClick: () => alert(value)})}
            />
            <Option
                markup={Default1}
                trigger="/"
                data={AnotherData}
            />
        </MarkedInput>
    )
}

const ConfiguredMarkedInput2 = createMarkedInput(Button, [{
    markup: Primary1,
    data: Data,
    initMark: ({label, value}) => ({label, primary: true, onClick: () => alert(value)})
}, {
    trigger: '/',
    markup: Default1,
    data: AnotherData
}])

export const App1 = () => {
    const [value, setValue] = useState(
        "Enter the '@' for creating @[Primary Mark](primary:Hello!) or '/' for @[Default mark](default)!"
    )
    return <ConfiguredMarkedInput2 value={value} onChange={setValue}/>
}

//TODO HTML editable tag
// @ts-ignore
const Tag = ({label, useMark}: MarkProps) => {
    const {mark, value, onChange} = useMark() as ReturnType<typeof useMark>

    return createElement(label, {
        ref: mark,
        contentEditable: true,
        suppressContentEditableWarning: true,
        children: value,
        style: {
            outline: 'none',
            whiteSpace: 'pre-wrap'
        },
        onInput: (e) => {
            onChange({label, value: e.currentTarget.textContent ?? ""}, {silent: true})
        }
    })
}

export const RichEditor = () => {
    const [value, setValue] = useState(`<h4>Dynamic marks:>` +
        `<i>This page introduces a feature that has not yet been published.>

This feature allows you to use dynamic marks to edit itself and beyond.

It can be used to simulate a rich editor with <b>bold>, <i>italic>, <mark>marked>, <small>smaller>, <del>deleted>, 
<ins>inserted>, <sub>subscript> and other types of text.`)

    return (
        <>
            <MarkedInput Mark={Tag} value={value} onChange={setValue}>
                <Option markup="<__label__>__value__>"/>
            </MarkedInput>

            <br/>
            <Text label="Plaint text:" value={value}/>
        </>
    )
}

export const Markdown = () => {
    const [value, setValue] = useState(`<h4>Dynamic marks:>` +
        `<i>This page introduces a feature that has not yet been published.>

This feature allows you to use dynamic marks to edit itself and beyond.

It can be used to simulate a rich editor with **bold**, <i>italic>, <mark>marked>, <small>smaller>, <del>deleted>, 
<ins>inserted>, <sub>subscript> and other types of text.`)

    return (
        <>
            <MarkedInput Mark={Tag} value={value} onChange={setValue}>
                <Option markup="**__label__**" initMark={props => ({label: "b", value: props.label})}/>
            </MarkedInput>

            <br/>
            <Text label="Plaint text:" value={value}/>
        </>
    )
}