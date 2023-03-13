import {useState} from "react";
import {createMarkedInput, denote, MarkedInput} from "rc-marked-input";
import {Mark, Markup} from "rc-marked-input/types";
import {Button} from "./assets/Button";
import {Text} from "./assets/Text";
import {getTitle} from "./assets/getTitle";

export default {
    title: getTitle(),
    component: MarkedInput,
}

const Mark = (props: Mark) => <mark onClick={_ => alert(props.value)}>{props.label}</mark>

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
                onContainer={{
                    onClick: (e) => console.log('onCLick'),
                    onInput: (e) => console.log('onInput'),
                    onBlur: (e) => console.log('onBlur'),
                    onFocus: (e) => console.log('onFocus'),
                    onKeyDown: (e) => console.log('onKeyDown'),
                }}
            />

            <Text label="Plaint text:" value={value}/>
            <Text label="Display text (denoted):" value={displayText}/>
        </>
    )
}