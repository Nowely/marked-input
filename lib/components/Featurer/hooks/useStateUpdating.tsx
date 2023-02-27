import {MarkedInputProps} from "../../MarkedInput";
import {extractOptions, useStore} from "../../../utils";
import {useEffect} from "react";

export const useStateUpdating = (props: MarkedInputProps<any>) => {
    const store = useStore()
    const {options, ...other} = props
    useEffect(() => store.setState({options: extractOptions(options)}), [options])
    useEffect(() => store.setState({...other}))
}