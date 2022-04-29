import {TaggedInput} from "../src";
import {ComponentMeta, ComponentStory} from "@storybook/react";
import {Button, ButtonProps} from "./Button";
import {useState} from "react";
import {Markup, MarkupProps} from "../src/Markup";

export default {
    title: "Example/TaggedInput",
    component: TaggedInput
} as ComponentMeta<typeof TaggedInput>

export const Basic = () => {
    const [value, setValue] = useState("Hello beautiful @first World @second!")

    return <>
        <TaggedInput Tag={Button} value={value} onChange={(val: string) => setValue(val)}>
            <Markup<ButtonProps> value={"@"} inner={{label: "Butt2on", size: "small"}}/>
        </TaggedInput>

        <br/>
        <input value={value} onChange={event => setValue(event.target.value)}/>
    </>
}