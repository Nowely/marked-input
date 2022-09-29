import {MarkProps, Type} from "../types";
import React, {RefObject, useCallback, useRef, useState} from "react";
import {useRegister, useStore} from "./index";
import {useHeldCaret} from "../components/EditableSpan/hooks/useHeldCaret";

export const useMark = (key: number, props: MarkProps) => {
    const {bus, props: {readOnly, spanStyle: style, spanClassName: className}} = useStore()

    const mark = useRegistration(key)

    const [label, setLabel] = useState(props.label)
    const [value, setValue] = useState(props.value)

    const onChange = useCallback((props: MarkProps, options?: {silent: boolean}) => {
        if (!options?.silent)
            setLabel(props.label)
        bus.send(Type.Change, {key, value: props.label})
    }, [])

    //TODO
    const onRemove = useCallback(() => {
        bus.send(Type.Delete, {key})
    }, [])

    const heldCaret = useHeldCaret()


    return {label, value, onChange, mark, onRemove, heldCaret, readOnly, style, className}
}

function useRegistration(key: number) {
    const register = useRegister()
    const ref = useRef<HTMLElement | null>(null)

    //TODO Rename to mark?
    return useCallback((elementOrRefObject: HTMLElement | RefObject<any>) => {
        let a = register(key)

        if (elementOrRefObject && 'current' in elementOrRefObject) {
            a(elementOrRefObject)
        } else {
            ref.current = elementOrRefObject
            // @ts-ignore
            a(ref)
        }
    }, [])
}