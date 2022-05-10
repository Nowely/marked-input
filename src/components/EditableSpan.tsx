import {CSSProperties, useEffect, useLayoutEffect, useRef} from "react";
import {assign, getCaretIndex, setCaretRightTo, setCaretTo, setCaretToEnd} from "../utils";
import {CaretManager} from "../hooks/useCaret";

export interface EditableSpanProps {
    id: number
    caret: CaretManager
    focused: number | null
    setFocused: Function
    value: string
    onChange?: Function
    className?: string
    style?: CSSProperties
}

export const EditableSpan = ({id, caret, focused, onChange, setFocused, value, ...props}: EditableSpanProps) => {
    const ref = useRef<HTMLSpanElement>(null)
    const style = assign({outline: "none"}, props.style)

    useEffect(() => {
        if (id !== focused || !ref.current) return

        if (caret.isEnd) {
            ref.current.focus()
            setCaretToEnd(ref.current)
            return;
        }

        ref.current.focus()
    }, [focused])

    useLayoutEffect(() => {
        if (!ref.current || !caret.isInteger) return;
        setCaretTo(ref.current, caret.position)
    })


    return (
        <span
            ref={ref}
            style={style}
            className={props.className}
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => {
                const newValue = e.currentTarget.textContent ?? ""
                caret.setPosition(getCaretIndex(e.currentTarget))
                onChange?.(newValue)

            }}
            onFocus={event => {
                setFocused(id)
            }}
            onBlur={event => {
                caret.clear()
            }}
            onPaste={(e) => {
                e.preventDefault();
                const text = e.clipboardData.getData("text");
                //e.currentTarget.textContent
                document.execCommand("insertText", false, text);
                //ref.current.innerText = text;
            }}
        >
            {value}
        </span>
    )
}