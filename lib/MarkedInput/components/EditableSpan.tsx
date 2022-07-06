import React, {ForwardedRef, forwardRef, RefObject, useEffect, useRef} from "react";
import {useStore} from "../utils";
import {useHeldCaret} from "../hooks/useHeldCaret";
import {Type} from "../types";
import {Caret} from "../hooks/useCaret";

export interface EditableSpanProps {
    id: number
    value: string
    focused: React.MutableRefObject<number | undefined>
}

//TODO Заменить forwardRef на обычный хук, внутри которого провайдер
export const EditableSpan = forwardRef(({id, value, focused}: EditableSpanProps, ref: ForwardedRef<RefObject<HTMLSpanElement>>) => {
    const {dispatch, caret, props: {readOnly, spanStyle, spanClassName}} = useStore()
    const spanRef = useRef<HTMLSpanElement>(null)

    if (typeof ref === "function") {
        ref(spanRef)
    }

    useEffect(() => {
        if (focused.current === id) {
            spanRef.current?.focus()
            focused.current = undefined

            let position = caret.getPosition()
            if (position && spanRef.current) {
                Caret.setIndex1(spanRef.current, position)
            }
        }
    })

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