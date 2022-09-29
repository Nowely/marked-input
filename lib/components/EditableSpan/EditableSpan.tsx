import React from "react";
import {useMark} from "../../utils/useMark";

export interface EditableSpanProps {
    label: string
    useMark: () => ReturnType<typeof useMark>
}

//Editable block - edit text here
export const EditableSpan = (props: EditableSpanProps) => {
    const {label, onChange, mark, heldCaret, className, style, readOnly} = props.useMark()

    const handleInput = (e: React.FormEvent<HTMLSpanElement>) => {
        heldCaret(e.currentTarget)
        const label = e.currentTarget.textContent ?? ""
        onChange({label}, {silent: true})
    }

    return (
        <span
            ref={mark}
            style={style}
            className={className}
            contentEditable={!readOnly}
            suppressContentEditableWarning
            onInput={handleInput}
            onPaste={handlePaste}
            children={label}
        />
    )
}

function handlePaste(e: React.ClipboardEvent<HTMLSpanElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    document.execCommand("insertText", false, text);
}