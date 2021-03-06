import React, {ForwardedRef, forwardRef, RefObject, useEffect, useRef} from "react";
import {useStore} from "../utils";
import {useHeldCaret} from "../hooks/useHeldCaret";
import {Type} from "../types";

export interface EditableSpanProps {
    id: number
    value: string
}

//TODO Instead forwardRef to hook
export const EditableSpan = forwardRef(({id, value}: EditableSpanProps, ref: ForwardedRef<RefObject<HTMLSpanElement>>) => {
    const {dispatch, props: {readOnly, spanStyle, spanClassName}} = useStore()
    const spanRef = useRef<HTMLSpanElement>(null)

    if (typeof ref === "function") {
        ref(spanRef)
    }

    const held = useHeldCaret(spanRef)

    const handleInput = (e: React.FormEvent<HTMLSpanElement>) => {
        held()
        const newValue = e.currentTarget.textContent ?? ""
        dispatch(Type.Change,{key: id, value: newValue})
    }

    return (
        <span
            ref={spanRef}
            style={spanStyle}
            className={spanClassName}
            contentEditable={!readOnly}
            suppressContentEditableWarning
            onInput={handleInput}
            onPaste={handlePaste}
            children={value}
        />
    )
})

function handlePaste(e: React.ClipboardEvent<HTMLSpanElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    document.execCommand("insertText", false, text);
}