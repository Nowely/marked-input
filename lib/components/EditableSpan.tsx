import React from 'react'
import {useMark} from '../utils/useMark'

//Editable block - edit text here
export const EditableSpan = () => {
    const {label, onChange, className, style, readOnly, ref} = useMark()

    const handleInput = (e: React.FormEvent<HTMLSpanElement>) => {
        const label = e.currentTarget.textContent ?? ''
        onChange({label}, {silent: true})
    }

    return (
        <span
            ref={ref}
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
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    document.execCommand('insertText', false, text)
}