import {MarkedInput, Option} from "../../lib";
import {useState} from "react";
import {Popover, Tag} from "rsuite";
import {TagProps} from "rsuite/esm/Tag/Tag";
//import 'rsuite/dist/rsuite.min.css';
import {Text} from "./assets/Text";
import {getTitle} from "./assets/getTitle";
import {PopoverProps} from "rsuite/esm/Popover/Popover";
import {KEY} from "rc-marked-input/constants";
import {ComponentMeta} from "@storybook/react";
import {withCSS} from "./assets/withCSS";

export default {
    title: getTitle("Rsuite"),
    component: MarkedInput,
    subcomponents: {Option},
    decorators: [withCSS('./rsuite.min.css')]
} as ComponentMeta<typeof MarkedInput>

export const TaggedInput = () => {
    const [value, setValue] = useState("Type the '@' to begin creating a @[tag](common:0). Then press the @[Enter](common:1) to finish. For example: @hello")
    const classNames = "rs-picker-tag-wrapper rs-picker-input rs-picker-toggle-wrapper rs-picker-tag"

    return <>
        <MarkedInput
            Overlay={Popover}
            className={classNames}
            style={{
                minHeight: 36,
                paddingRight: 5
            }}
            spanClassName="rs-tag rs-tag-md"
            spanStyle={{
                backgroundColor: "white",
                paddingLeft: 0,
                paddingRight: 0,
                whiteSpace: "pre-wrap",
                minWidth: 5
            }}
            Mark={Tag}
            value={value}
            onChange={(val: string) => setValue(val)}
        >
            <Option<TagProps, PopoverProps>
                initOverlay={props => {
                    document.addEventListener("keydown", ev => {
                        if (ev.key === KEY.ENTER) {
                            props.onSelect({label: props.trigger.value, value: props.trigger.index.toString()})
                            props.onClose()
                        }
                    }, {once: true})
                    return {
                        children: `Press 'Enter' to create: ${props.trigger.value}`,
                        visible: true,
                        style: props.style,
                    }
                }}
                markup="@[__label__](common:__value__)"
                initMark={({label}) => ({children: label})}
            />
        </MarkedInput>

        <br/>
        <Text label="Plaint text:" value={value}/>
    </>
}