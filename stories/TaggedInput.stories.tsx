import {TaggedInput} from "../src";
import {ComponentMeta, ComponentStory} from "@storybook/react";
import {Button, ButtonProps} from "./assets/Button";
import {useState} from "react";
import {Markup, MarkupProps} from "../src";

export default {
    title: "TaggedInput",
    component: TaggedInput,
} as ComponentMeta<typeof TaggedInput>

export const Basic = () => {
    const [value, setValue] = useState("Hello beautiful the @[first](primary:1) world from the @[second](secondary:2)" +
        "and @[third](primary:1),and @[fourth](secondary:2)!")

    return <>
        <TaggedInput Tag={Button} value={value} onChange={(val: string) => setValue(val)}>
            <Markup<ButtonProps> value="@[__value__](primary:__id__)" valueKey="label" inner={{label: "Button", primary: true}}/>
            <Markup<ButtonProps> value="@[__value__](secondary:__id__)" valueKey="label" inner={{label: "Button"}}/>
        </TaggedInput>

        <br/>
        <textarea style={{width: '45%'}} value={value} onChange={event => setValue(event.target.value)}/>
    </>
}