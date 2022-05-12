import {CSSProperties, useRef} from "react";
import {assign} from "../utils";
import {Caret} from "../hooks/useCaret";
import {useHeldCaret} from "../hooks/useHeldCaret";
import {Focus} from "../hooks/useFocus";
import {useRestoredFocus} from "../hooks/useRestoredFocus";

export interface EditableSpanProps {
    id: number
    caret: Caret
    focus: Focus
    value: string
    onChange?: Function
    className?: string
    style?: CSSProperties
}

export const EditableSpan = ({id, caret, onChange, value, focus, ...props}: EditableSpanProps) => {
    const ref = useRef<HTMLSpanElement>(null)
    const style = assign({outline: "none", whiteSpace: 'pre-wrap'}, props.style)

    const held = useHeldCaret()
    focus.useManualFocus(id, ref)
    useRestoredFocus(caret, ref)


    return (
        <span
            ref={ref}
            style={style}
            className={props.className}
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => {
                held()
                onChange?.(e.currentTarget.textContent ?? "")
            }}
            onFocus={event => {
                focus.setFocused(id)
            }}
            onBlur={event => {
                focus.setFocused(null)
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