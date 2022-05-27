import React, {useRef} from "react";
import {useStore} from "../utils";
import {useHeldCaret} from "../hooks/useHeldCaret";
import {useRestoredFocus} from "../hooks/useRestoredFocus";
import {Type} from "../types";

export interface EditableSpanProps {
    id: number
    value: string
}

export const EditableSpan = ({id, value}: EditableSpanProps) => {
    const {caret, focus, dispatch, props: {readOnly, spanStyle, spanClassName}} = useStore()
    const ref = useRef<HTMLSpanElement>(null)
    const held = useHeldCaret(ref)

    focus.useManualFocus(id, ref)
    useRestoredFocus(caret, ref)

    const handleInput = (e: React.FormEvent<HTMLSpanElement>) => {
        held()
        const newValue = e.currentTarget.textContent ?? ""
        dispatch(Type.Change,{key: id, value: newValue})
    }

    const handlePaste = (e: React.ClipboardEvent<HTMLSpanElement>) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text");
        document.execCommand("insertText", false, text);
    }

    return (
        <span
            ref={ref}
            style={spanStyle}
            className={spanClassName}
            contentEditable={!readOnly}
            suppressContentEditableWarning
            onInput={handleInput}
            onFocus={() => focus.setFocused(id)}
            onBlur={() => focus.setFocused(null)}
            onPaste={handlePaste}
            children={value}
        />
    )
}