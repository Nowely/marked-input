import {MarkedInput, Option} from "../src";
import {useState} from "react";
import 'antd/dist/antd.css';
import {Tag} from "antd";
import {TagProps, TagType} from "antd/lib/tag";

export default {component: MarkedInput, subcomponents: {Option}}

export const Ant = () => {
    const [value, setValue] = useState("Hello beautiful the @[first](outlined:1) world from the @[second](common:2)")
    const classNames = ""

    return <>
        <MarkedInput
            /*className={classNames}
            style={{
                minHeight: 36
            }}
            spanClassName="rs-tag rs-tag-md"
            spanStyle={{
                backgroundColor: "white",
                paddingLeft: 0,
                paddingRight: 0
            }}*/
            Mark={Tag}
            value={value}
            onChange={(val: string) => setValue(val)}
        >
            <Option<TagProps>
                markup="@[__value__](outlined:__id__)"
                initializer={(children, id) => ({children, closable : true})}
            />
            <Option<TagProps>
                markup="@[__value__](common:__id__)"
                initializer={(children, id) => ({children})}
            />
        </MarkedInput>

        <br/>
        <br/>
        <textarea style={{width: '45%'}} value={value} onChange={event => setValue(event.target.value)}/>
    </>
}