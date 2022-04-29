import {forwardRef, KeyboardEvent, useEffect, useRef} from "react";
import {getCaretIndex, setCaretRightTo, setCaretToEnd} from "../utils";

export interface EditableCellProps {
    index: number
    active: number | null
    setActive: Function
    value: string
    onChange?: Function
    next?: Function
    previous?: Function
    remove?: Function
    onBlur?: Function
    isTail: any
}

export const EditableCell = forwardRef((props: EditableCellProps, ref: any) => {
    const inputRef = useRef<any>()
    const valueRef = useRef(props.value)
    //ref1.current.

    const handleKeyboardEvent = (e: KeyboardEvent<HTMLSpanElement>) => {
        //TODO incorrect caret
        if (e.key === "ArrowLeft" && getCaretIndex(inputRef.current) === 0)
            props.previous?.()

        if (e.key === "ArrowRight" && getCaretIndex(inputRef.current) === valueRef.current.length)
            props.next?.()

        if (e.key === "Backspace" && getCaretIndex(inputRef.current) === 0)
            props.remove?.()

    };

    useEffect(() => {
        if (props.active === props.index) {
            inputRef.current?.focus()

            if (props.isTail.current) {
                //setCaretToEnd(inputRef.current)
                props.isTail.current = false
            }
        }
    })

    return (
        <span
            onBlur={(e) => {props.onBlur?.(e)}}
            ref={inputRef}
            style={{outline: "none"}}
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => {
                const newValue = e.currentTarget.textContent ?? ""
                valueRef.current = newValue
                //console.log(newValue);
                props.onChange?.(newValue)
                //setCaretRightTo(inputRef.current, 2)
                //console.log(getCaretIndex(inputRef.current))
            }}
            onFocus={event => {
                props.setActive(props.index)
            }}
            /*onBlur={event => {
                if (props.active === props.index)
                    props.setActive(null)
            }}*/
            onKeyDown={handleKeyboardEvent}
            //onKeyUp={handleKeyboardEvent}
            onPaste={(e) => {
                e.preventDefault();
                const text = e.clipboardData.getData("text");
                document.execCommand("insertText", false, text);
                //inputRef.current.innerText = text;
            }}
        >
            {valueRef.current}
        </span>
    )
})