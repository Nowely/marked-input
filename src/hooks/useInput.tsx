import {Option, OptionProps} from "../Option";
import {ButtonProps} from "../../stories/assets/Button";
import {MarkedInput} from "../MarkedInput";

//TODO hook initialize way
const useInput = () => {
    const A = Option as (props: OptionProps<ButtonProps>) => null
    return {TaggedInput: MarkedInput, A}
}