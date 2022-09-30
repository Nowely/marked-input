import {MarkProps, PieceNode, Type} from "../types";
import {RefObject, useCallback, useRef, useState} from "react";
import {isObject, useRegister, useStore} from "./index";
import {useHeldCaret} from "../components/EditableSpan/hooks/useHeldCaret";

export const useMark = (node: PieceNode) => {
    const {bus, props: {readOnly, spanStyle: style, spanClassName: className}} = useStore()

    //const mark = useRegistration(key)
    /*const ref = useRef<HTMLElement | null>(null)
    node.ref = ref*/

    //TODO функция по оборачиванию рефа. Использовать null
    const ref = useRef<HTMLElement | null>(null)
    const mark = useCallback((elementOrRef: HTMLElement | RefObject<HTMLElement> | null) => {
        if (elementOrRef && 'current' in elementOrRef) {
            node.ref = elementOrRef
            return
        }
        ref.current = elementOrRef
        node.ref = ref
    }, [])

    //const a = isObject(node.piece) ?? node.piece : node.piece
    // @ts-ignore
    const [label, setLabel] = useState<string>(node.piece)
    //const [value, setValue] = useState<string>(props.value)

    const onChange = useCallback((props: MarkProps, options?: { silent: boolean }) => {
        if (!options?.silent) {
            setLabel(props.label)
        }
        bus.send(Type.Change, {key: node.key, value: props.label})
    }, [])

    //TODO
    const onRemove = useCallback(() => {
        bus.send(Type.Delete, {key: node.key})
    }, [])

    const heldCaret = useHeldCaret()

    return {label, mark, onChange, onRemove, heldCaret, readOnly, style, className}
}

function useRegistration(key: number) {
    const register = useRegister()
    const ref = useRef<HTMLElement | null>(null)

    //TODO Rename to mark?
    return useCallback((elementOrRef: HTMLElement | RefObject<any>) => {
        let a = register(key)

        if (elementOrRef && 'current' in elementOrRef) {
            a(elementOrRef)
        } else {
            ref.current = elementOrRef
            // @ts-ignore
            a(ref)
        }
    }, [])
}