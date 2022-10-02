import {Mark, NodeData, Type} from "../types";
import {RefObject, useCallback, useRef, useState} from "react";
import {useStore} from "./index";
import {useHeldCaret} from "../components/EditableSpan/hooks/useHeldCaret";

//TODO
export const useMark = (node: NodeData) => {
    const {bus, props: {readOnly, spanStyle: style, spanClassName: className}} = useStore()

    const mark = useRegistration(node)

    const [label, setLabel] = useState<string>(node.piece.label)
    const [value, setValue] = useState<string | undefined>(node.piece.value)

    const onChange = useCallback((props: Mark, options?: { silent: boolean }) => {
        if (!options?.silent) {
            setLabel(props.label)
            setValue(props.value)
        }
        bus.send(Type.Change, {key: node.key, value: {...props}})
    }, [])

    const onRemove = useCallback(() => {
        setLabel('')
        setValue(undefined)
        bus.send(Type.Delete, {key: node.key})
    }, [])

    const heldCaret = useHeldCaret()

    return {label, value, mark, onChange, onRemove, heldCaret, readOnly, style, className}
}

function useRegistration(node: NodeData) {
    const ref = useRef<HTMLElement | null>(null)
    return useCallback((elementOrRef: HTMLElement | RefObject<HTMLElement> | null) => {
        if (elementOrRef && 'current' in elementOrRef) {
            node.ref = elementOrRef
            return
        }
        ref.current = elementOrRef
        node.ref = ref
    }, [])
}