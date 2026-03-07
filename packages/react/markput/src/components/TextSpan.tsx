import {resolveSlot, resolveSlotProps} from '@markput/core'
import type {ElementType} from 'react'
import {useLayoutEffect, useMemo, useRef} from 'react'

import {useStore} from '../lib/providers/StoreContext'
import {useToken} from '../lib/providers/TokenContext'

export const TextSpan = () => {
	const token = useToken()
	const store = useStore()
	const ref = useRef<HTMLSpanElement>(null)

	const readOnly = store.state.readOnly.use()
	const slots = store.state.slots.use()
	const slotProps = store.state.slotProps.use()
	const SpanComponent = useMemo(() => resolveSlot<ElementType>('span', slots), [slots])
	const spanProps = useMemo(() => resolveSlotProps('span', slotProps), [slotProps])

	if (token.type !== 'text') {
		throw new Error('TextSpan component expects a TextToken')
	}

	useLayoutEffect(() => {
		if (ref.current && ref.current.textContent !== token.content) {
			ref.current.textContent = token.content
		}
	}, [token.content])

	return <SpanComponent {...spanProps} ref={ref} contentEditable={!readOnly} suppressContentEditableWarning />
}