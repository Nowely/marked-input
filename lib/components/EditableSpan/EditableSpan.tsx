import React, {ForwardedRef, forwardRef, RefObject, useEffect, useReducer, useRef, useState} from "react";
import {useStore, usePieces} from "../../utils";
import {useHeldCaret} from "./hooks/useHeldCaret";
import {Type} from "../../types";
import {useMark} from "../../utils/useMark";

export interface EditableSpanProps {
    label: string
    useMark: () => ReturnType<typeof useMark>
}

//Editable block - edit text here
export const EditableSpan = (props: EditableSpanProps) => {
    const {props: {span}} = useStore()
    //TODO get spans props from useMark
    const {readOnly, spanStyle, spanClassName} = span
    const spanRef = useRef<HTMLSpanElement>(null)

    const {label, onChange, refReg, onRemove} = props.useMark()

    refReg(spanRef)
    /*if (typeof ref === "function") {
        ref(spanRef)
    }*/

    //TODO Rename this. Move to useMark
    const heldCaret = useHeldCaret(spanRef)
    const handleInput = (e: React.FormEvent<HTMLSpanElement>) => {
        heldCaret()
        const value = e.currentTarget.textContent ?? ""
        onChange({label: value})
    }

    /*useEffect(() => {
        console.log(`${value} was updated`)
    })

    useEffect(() => {
        console.log(`${value} was mounted`)
        return () => console.log(`${value} was unmounted`)
    }, [])*/

    return (
        <span
            ref={spanRef}
            style={spanStyle}
            className={spanClassName}
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