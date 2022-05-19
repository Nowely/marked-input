import {Button, ButtonProps} from "./assets/Button";
import {MarkedInput, Option} from "../src";
import {useState} from "react";

export default {component: MarkedInput, subcomponents: {Option}}

export const Base = () => {
    const [value, setValue] = useState("Hello beautiful @[first](primary:1) world from the @[second](secondary:2)" +
        " and @[third](primary:1), and @[fourth](secondary:2)!")

    return (
        <>
            <MarkedInput
                style={{minWidth: 100}}
                spanStyle={{width: 'auto', minWidth: 10}}
                Mark={Button} value={value} onChange={setValue}>
                <Option<ButtonProps>
                    markup="@[__value__](primary:__id__)"
                    initializer={(label, id) => ({label, primary: true, onClick: () => alert(id)})}
                />
                <Option<ButtonProps>
                    markup="@[__value__](secondary:__id__)"
                    initializer={(label, id) => ({label})}
                />
            </MarkedInput>

            <br/>
            <textarea style={{width: '45%'}} value={value} onChange={event => setValue(event.target.value)}/>
        </>
    )
}