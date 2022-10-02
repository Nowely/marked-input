import React from "react";
import {MarkProps} from "../../types";

//Editable block - edit text here
export const EditableSpan = (props: MarkProps) => {
    // @ts-ignore
    const {label, mark, onChange, heldCaret, className, style, readOnly} = props.useMark()

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