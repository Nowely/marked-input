import {forwardRef, KeyboardEvent, memo, useEffect, useLayoutEffect, useRef, useState} from "react";
import {getCaretIndex, setCaretRightTo, setCaretTo, setCaretToEnd} from "../utils";
import {KEY} from "../constants";

export interface EditableCellProps {
    index: number
    active: number | null
    setActive: Function
    value: string
    onChange?: Function
}

export const EditableCell = (props: EditableCellProps) => {
    const ref = useRef<HTMLSpanElement>(null)
    const [caretIndex, setCaretIndex] = useState(0)

    useEffect(() => {
        if (props.active === null) return
        if (!ref.current) return;

        if (props.active === props.index) {
            ref.current?.focus()
            return;
        }

        if (props.active === -props.index) {
            ref.current?.focus()
            setCaretToEnd(ref.current)
            return;
        }
    }, [props.active])

    useLayoutEffect(() => {
        if (!caretIndex) return
        if (!ref.current) return;
        setCaretTo(ref.current, caretIndex)
    })

    return (
        <span
            ref={ref}
            style={{outline: "none"}}
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => {
                const newValue = e.currentTarget.textContent ?? ""
                setCaretIndex(getCaretIndex(e.currentTarget))
                props.onChange?.(newValue)

            }}
            onFocus={event => {
                props.setActive(props.index)
            }}
            /*onBlur={event => {
                if (props.active === props.index)
                    props.setActive(null)
            }}*/
            onPaste={(e) => {
                e.preventDefault();
                const text = e.clipboardData.getData("text");
                //e.currentTarget.textContent
                document.execCommand("insertText", false, text);
                //ref.current.innerText = text;
            }}
        >
            {props.value}
        </span>
    )
}