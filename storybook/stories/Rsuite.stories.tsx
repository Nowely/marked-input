import {MarkedInput, Option, useOverlay} from "../../lib";
import {useEffect, useState} from "react";
import {Popover, Tag} from "rsuite";
import {TagProps} from "rsuite/esm/Tag/Tag";
//import 'rsuite/dist/rsuite.min.css';
import {Text} from "./assets/Text";
import {getTitle} from "./assets/getTitle";
import {KEY} from "rc-marked-input/constants";
import {ComponentMeta} from "@storybook/react";
import {withStyle} from "./assets/withStyle";

export default {
    title: getTitle("Rsuite"),
    component: MarkedInput,
    subcomponents: {Option},
    decorators: [withStyle('rsuite.min.css')]
} as ComponentMeta<typeof MarkedInput>

const Overlay = () => {
    const {style, trigger, onSelect, onClose} = useOverlay()

    useEffect(() => {
        const handleEnter = (ev: KeyboardEvent) => {
            if (ev.key === KEY.ENTER) {
                ev.preventDefault()
                onSelect({label: trigger.value})
                onClose()
            }
        }

        document.addEventListener("keydown", handleEnter)
        return () => document.removeEventListener("keydown", handleEnter)
    }, [trigger])

    return <Popover style={style} visible>
        <i> Press the <b>'Enter'</b> to create: <b>{`${trigger.value}`}</b> </i>
    </Popover>
}

export const TaggedInput = () => {
    const [value, setValue] = useState("Type the '@' to begin creating a @[tag](common). Then press the @[Enter](common) to finish. For example: @hello")
    const classNames = "rs-picker-tag-wrapper rs-picker-input rs-picker-toggle-wrapper rs-picker-tag"

    return <>
        <MarkedInput
            Mark={Tag}
            Overlay={Overlay}
            value={value}
            onChange={(val: string) => setValue(val)}
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
            onContainer={{
                onKeyDown(e) {
                    if (e.key === 'Enter')
                        e.preventDefault()
                }
            }}
        >
            <Option<TagProps>
                markup="@[__label__](common)"
                initMark={({label}) => ({children: label, style: {marginLeft: 0}})}
            />
        </MarkedInput>

        <br/>
        <Text label="Plaint text:" value={value}/>
    </>
}