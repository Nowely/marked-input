import {getTitle} from "./assets/getTitle";
import {MarkedInput, Option} from "rc-marked-input";
import {MarkProps, OverlayProps} from "rc-marked-input/types";
import React, {useState} from "react";

export default {
    title: getTitle(),
    component: MarkedInput,
    subcomponents: {Option}
}

const Mark = (props: MarkProps) => <mark>{props.label}</mark>

export const DefaultOverlay = () => {
    const [value, setValue] = useState("Hello, default - suggestion overlay by trigger @!")
    return <MarkedInput Mark={Mark} value={value} onChange={setValue}>
        <Option data={['First', 'Second', 'Third']}/>
    </MarkedInput>
}

const Overlay = () => <h1>I am the overlay</h1>
export const CustomOverlay = () => {
    const [value, setValue] = useState("Hello, custom overlay by trigger @!")
    return <MarkedInput Mark={() => null} Overlay={Overlay} value={value} onChange={setValue}/>
}

export const CustomTrigger = () => {
    const [value, setValue] = useState("Hello, custom overlay by trigger /!")
    return <MarkedInput Mark={() => null} Overlay={Overlay} value={value} onChange={setValue}>
        <Option trigger='/'/>
    </MarkedInput>
}

const Tooltip = (props: OverlayProps) => <div style={{position: 'absolute', ...props.style}}>I am the overlay</div>
export const PositionedOverlay = () => {
    const [value, setValue] = useState("Hello, positioned overlay by trigger @!")
    return <MarkedInput Mark={() => null} Overlay={Tooltip} value={value} onChange={setValue}/>
}

const List = (props: OverlayProps) => <ul>
    <li onClick={() => props.onSelect({label: 'First'})}>Clickable First</li>
    <li onClick={() => props.onSelect({label: 'Second'})}>Clickable Second</li>
</ul>

export const SelectableOverlay = () => {
    const [value, setValue] = useState("Hello, suggest overlay by trigger @!")
    return <MarkedInput Mark={Mark} Overlay={List} value={value} onChange={setValue}/>
}