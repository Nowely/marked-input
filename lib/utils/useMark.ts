import {Mark, NodeData, Type} from "../types";
import {CSSProperties, RefObject, useCallback, useRef, useState} from "react";
import {useNode, useStore} from "./index";
import {useSelector} from "./useSelector";

export interface DynamicMark extends Mark {
    /**
     * Register a mark ref. Used for focusing and key operation.
     */
    reg: ReturnType<typeof useRegistration>
    /**
     * Change mark.
     * @silent doesn't change itself label and value, only pass change event.
     */
    onChange: (props: Mark, options?: { silent: boolean }) => void
    /**
     * Remove itself.
     */
    onRemove: () => void
    /**
     * Passed the readOnly prop value
     */
    readOnly?: boolean
    /**
     * Passed style of span
     */
    style?: CSSProperties
    /**
     * Passed class name of span
     */
    className?: string
}

export const useMark = (): DynamicMark => {
    const node = useNode()
    const {bus} = useStore()
    const {style, className, readOnly} = useSelector(state => ({
        readOnly: state.readOnly,
        style: state.spanStyle,
        className: state.spanClassName
    }), true)

    const reg = useRegistration(node)

    const [label, setLabel] = useState<string>(node.mark.label)
    const [value, setValue] = useState<string | undefined>(node.mark.value)

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

    return {label, value, reg, onChange, onRemove, readOnly, style, className}
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