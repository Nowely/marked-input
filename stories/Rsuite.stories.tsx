import {MarkedInput} from "../src";
import {useState} from "react";
import {Option} from "../src";
import {Tag} from "rsuite";
import {TagProps} from "rsuite/esm/Tag/Tag";
import 'rsuite/dist/rsuite.min.css';
import {PlainText} from "./assets/PlainText";
import {getTitleOfStyled} from "./assets/getTitle";

export default {
    title: getTitleOfStyled("Rsuite"),
    component: MarkedInput,
    subcomponents: {Option}
}

//TODO to stylish folder
export const TaggedInput = () => {
    const [value, setValue] = useState("Hello beautiful the @[first](closable:1) world from the @[second](common:2)")
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
                markup="@[__value__](closable:__id__)"
                initializer={(children, id) => ({children, closable: true})}
            />
            <Option<TagProps>
                markup="@[__value__](common:__id__)"
                initializer={(children, id) => ({children})}
            />
        </MarkedInput>

        <br/>
        <PlainText value={value}/>
    </>
}

//TODO add mui example
//TODO add ant design example