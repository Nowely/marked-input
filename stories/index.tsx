import {MarkedInput} from "../src";
import {ComponentMeta, ComponentStory} from "@storybook/react";
import {Button, ButtonProps} from "./assets/Button";
import {useState} from "react";
import {Option, OptionProps} from "../src";
import {Tag} from "rsuite";
import {TagProps} from "rsuite/esm/Tag/Tag";
import 'rsuite/dist/rsuite.min.css';

export default {
    title: "TaggedInput",
    component: MarkedInput,
} as ComponentMeta<typeof MarkedInput>


export const Basic = () => {
    const [value, setValue] = useState("Hello beautiful the @[first](primary:1) world from the @[second](secondary:2)" +
        "and @[third](primary:1),and @[fourth](secondary:2)!")

    return (
        <>
            <MarkedInput Mark={Button} value={value} onChange={(val: string) => setValue(val)}>
                <Option<ButtonProps>
                    markup="@[__value__](primary:__id__)"
                    valueKey="label"
                    inner={{label: "Button", primary: true}}
                />
                <Option<ButtonProps>
                    markup="@[__value__](secondary:__id__)"
                    valueKey="label"
                    inner={{label: "Button"}}
                />
            </MarkedInput>

            <br/>
            <textarea style={{width: '45%'}} value={value} onChange={event => setValue(event.target.value)}/>
        </>
    )
}

export const Rsuite = () => {
    const [value, setValue] = useState("Hello beautiful the @[first](primary:1) world from the @[second](secondary:2)")
    const classNames = "rs-picker-tag-wrapper rs-picker-input rs-picker-toggle-wrapper rs-picker-tag"

    return <>
        <MarkedInput
            className={classNames}
            style={{
                minHeight: 36
            }}
            spanClassName="rs-tag rs-tag-md"
            spanStyle={{
                backgroundColor: "white",
                paddingLeft: 0,
                paddingRight: 0
            }}
            Mark={Tag}
            value={value}
            onChange={(val: string) => setValue(val)}
        >
            <Option<TagProps>
                markup="@[__value__](primary:__id__)"
                valueKey="children"
                inner={{children: "Button", closable: true}}
            />
            <Option<TagProps>
                markup="@[__value__](secondary:__id__)"
                valueKey="children"
                inner={{children: "Button"}}
            />
        </MarkedInput>

        <br/>
        <br/>
        <textarea style={{width: '45%'}} value={value} onChange={event => setValue(event.target.value)}/>
    </>
}

