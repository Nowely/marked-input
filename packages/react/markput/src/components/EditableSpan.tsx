import type {ClipboardEvent} from 'react'
import {useMemo} from 'react'
import {resolveSlot, resolveSlotProps} from '../lib/utils/resolveSlot'
import {useMark} from '../lib/hooks/useMark'
import {useStore} from '../lib/hooks/useStore'

export const EditableSpan = () => {
	const mark = useMark()
	const store = useStore()
	const slots = store.state.slots.use()
	const slotProps = store.state.slotProps.use()
	const SpanComponent = useMemo(() => resolveSlot('span', slots), [slots])
	const spanProps = useMemo(() => resolveSlotProps('span', slotProps), [slotProps])

	return <SpanComponent {...spanProps} ref={mark.ref} contentEditable={!mark.readOnly} onPaste={handlePaste} />
}

function handlePaste(e: ClipboardEvent<HTMLSpanElement>) {
	e.preventDefault()
	const text = e.clipboardData.getData('text')
	document.execCommand('insertText', false, text)
}
