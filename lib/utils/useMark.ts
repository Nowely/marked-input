import {MarkProps, Type} from "../types";
import {useCallback, useEffect, useRef, useState} from "react";
import {useStore} from "./index";

export const useMark = (key: number, props: MarkProps) => {
    const {bus} = useStore()
    const [label, setLabel] = useState(props.label)
    const [value, setValue] = useState(props.value)

    const onChange = useCallback((props: MarkProps) => {
        setLabel(props.label)
        bus.send(Type.Change,{key, value: props.label})
    }, [])

    /*useEffect(() => {
        console.log(`I was updated`)
    })

    useEffect(() => {
        console.log(`I was mounted`)
        return () => console.log(`I was unmounted`)
    }, [])*/

    return {label, value, onChange}
}