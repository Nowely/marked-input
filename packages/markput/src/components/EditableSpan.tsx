import type {ClipboardEvent} from 'react'
import {resolveSlot, resolveSlotProps} from '../lib/functions/resolveSlot'
import {useMark} from '../lib/hooks/useMark'
import {useStore} from '../lib/hooks/useStore'

//Editable block - edit text here
export const EditableSpan = () => {
	const mark = useMark()
	const {SpanComponent, spanProps} = useStore(
		state => ({
			SpanComponent: resolveSlot('span', state),
			spanProps: resolveSlotProps('span', state),
		}),
		true
	)

	return <SpanComponent {...spanProps} ref={mark.ref} contentEditable={!mark.readOnly} onPaste={handlePaste} />
}

function handlePaste(e: ClipboardEvent<HTMLSpanElement>) {
	e.preventDefault()
	const text = e.clipboardData.getData('text')
	document.execCommand('insertText', false, text)
}
