import React, {useRef} from "react";
import {toString, useStore} from "../utils";
import {useHeldCaret} from "../hooks/useHeldCaret";
import {useRestoredFocus} from "../hooks/useRestoredFocus";

export interface EditableSpanProps {
    id: number
    value: string
}

export const EditableSpan = ({id, value, ...props}: EditableSpanProps) => {
    const {caret, focus, spanStyle, spanClassName, readOnly, sliceMap, onChange, configs} = useStore()
    const ref = useRef<HTMLSpanElement>(null)
    const held = useHeldCaret()

    focus.useManualFocus(id, ref)
    useRestoredFocus(caret, ref)

    const handleInput = (e: React.FormEvent<HTMLSpanElement>) => {
        held()
        const newValue = e.currentTarget.textContent ?? ""
        sliceMap.set(id, newValue)
        onChange(toString([...sliceMap.values()], configs))
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