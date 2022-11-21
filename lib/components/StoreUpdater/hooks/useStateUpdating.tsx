import {MarkedInputProps} from "../../MarkedInput";
import {extractOptions, useStore} from "../../../utils";
import {useEffect} from "react";

export const useStateUpdating = (props: MarkedInputProps<any, any>) => {
    const store = useStore()
    const {children, ...other} = props
    useEffect(() => store.setState({options: extractOptions(children)}), [children])
    useEffect(() => store.setState({...other}))
}