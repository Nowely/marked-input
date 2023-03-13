import {Mark, Type} from "../types";
import {CSSProperties, RefObject, useCallback, useState} from "react";
import {useNode, useStore} from "./index";
import {useSelector} from "./useSelector";

export interface DynamicMark<T> extends Mark {
    /**
     * Change mark.
     * @options.silent doesn't change itself label and value, only pass change event.
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
    /**
     * Mark ref. Used for focusing and key handling operations.
     */
    ref: RefObject<T>
}

export const useMark = <T extends HTMLElement = HTMLElement,>(): DynamicMark<T> => {
    const node = useNode()
    const {bus} = useStore()
    const {style, className, readOnly} = useSelector(state => ({
        readOnly: state.readOnly,
        style: state.spanStyle,
        className: state.spanClassName
    }), true)

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

    return {label, value, onChange, onRemove, readOnly, style, className, ref: node.ref as RefObject<T>}
}