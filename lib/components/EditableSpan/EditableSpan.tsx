import React, {ForwardedRef, forwardRef, RefObject, useEffect, useReducer, useRef, useState} from "react";
import {useStore, usePieces} from "../../utils";
import {useHeldCaret} from "./hooks/useHeldCaret";
import {Type} from "../../types";

export interface EditableSpanProps {
    id: number
    value: string
}

//Editable block - edit text here
//TODO Instead forwardRef to hook
export const EditableSpan = forwardRef((props: EditableSpanProps, ref: ForwardedRef<RefObject<HTMLSpanElement>>) => {
    const {bus, props: {span}} = useStore()
    const {readOnly, spanStyle, spanClassName} = span
    const spanRef = useRef<HTMLSpanElement>(null)

    const [value, setValue] = useState(props.value)

    //usePieces()

    if (typeof ref === "function") {
        ref(spanRef)
    }

    const held = useHeldCaret(spanRef)
    const handleInput = (e: React.FormEvent<HTMLSpanElement>) => {
        held()
        const value = e.currentTarget.textContent ?? ""
        setValue(value)
        bus.send(Type.Change,{key: props.id, value})
    }

    useEffect(() => {
        console.log(`${value} was updated`)
    })

    useEffect(() => {
        console.log(`${value} was mounted`)
        return () => console.log(`${value} was unmounted`)
    }, [])

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