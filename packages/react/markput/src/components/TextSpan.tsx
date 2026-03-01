import type {ClipboardEvent} from 'react'
import {useLayoutEffect, useMemo, useRef} from 'react'
import {resolveSlot, resolveSlotProps} from '../lib/utils/resolveSlot'
import {useStore} from '../lib/hooks/useStore'
import {useToken} from '../lib/providers/TokenProvider'

export const TextSpan = () => {
	const token = useToken()
	const store = useStore()
	const ref = useRef<HTMLSpanElement>(null)

	const readOnly = store.state.readOnly.use()
	const slots = store.state.slots.use()
	const slotProps = store.state.slotProps.use()
	const SpanComponent = useMemo(() => resolveSlot('span', slots), [slots])
	const spanProps = useMemo(() => resolveSlotProps('span', slotProps), [slotProps])

	if (token.type !== 'text') {
		throw new Error('TextSpan component expects a TextToken')
	}

	useLayoutEffect(() => {
		if (ref.current && ref.current.textContent !== token.content) {
			ref.current.textContent = token.content
		}
	}, [token.content])

	return (
		<SpanComponent
			{...spanProps}
			ref={ref}
			contentEditable={!readOnly}
			onPaste={handlePaste}
			suppressContentEditableWarning
		/>
	)
}

function handlePaste(e: ClipboardEvent<HTMLSpanElement>) {
	e.preventDefault()
	const text = e.clipboardData.getData('text')
	document.execCommand('insertText', false, text)
}
