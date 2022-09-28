import {MarkProps, Type} from "../types";
import React, {RefObject, useCallback, useEffect, useRef, useState} from "react";
import {useRegister, useStore} from "./index";

export const useMark = (key: number, props: MarkProps) => {
    const {bus} = useStore()

    const register = useRegister()

    const ref = useRef<HTMLElement>()

    //TODO Rename to mark?
    const refReg = useCallback((elementOrRefObject: HTMLElement | RefObject<any>) => {
        let a = register(key)

        if ('current' in elementOrRefObject) {
            a(elementOrRefObject)
        }
        else {
            ref.current = elementOrRefObject
            // @ts-ignore
            a(ref)
        }
    }, [])

    const [label, setLabel] = useState(props.label)
    const [value, setValue] = useState(props.value)

    const onChange = useCallback((props: MarkProps) => {
        setLabel(props.label)
        bus.send(Type.Change,{key, value: props.label})
    }, [])

    //TODO
    const onRemove = useCallback(() => {
        bus.send(Type.Delete,{key})
    }, [])

    /*useEffect(() => {
        console.log(`I was updated`)
    })

    useEffect(() => {
        console.log(`I was mounted`)
        return () => console.log(`I was unmounted`)
    }, [])*/

    return {label, value, onChange, refReg, onRemove}
}