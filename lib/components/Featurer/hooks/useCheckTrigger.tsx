import {useCallback} from 'react'
import {SystemEvent} from '../../../constants'
import {OverlayTrigger, Payload} from '../../../types'
import {useStore} from '../../../utils'
import {Store} from '../../../utils/Store'
import {useListener} from '../../../utils/useListener'

export function useCheckTrigger() {
	const store = useStore()

	const sendCheckTrigger = useCallback((e: Event | Payload) =>
		isMatch(e, store) && store.bus.send(SystemEvent.CheckTrigger), [])

	useListener('focusin', () =>
		document.addEventListener('selectionchange', sendCheckTrigger), [])

	useListener('focusout', () =>
		document.removeEventListener('selectionchange', sendCheckTrigger), [])

	useListener(SystemEvent.Change, sendCheckTrigger, [])
}


function isMatch(e: Event | Payload, store: Store) {
	let trigger = store.state.trigger ?? 'change'
	let type: OverlayTrigger

	if ('key' in e) type = 'change'
	else type = 'selectionChange'

	return trigger === type || trigger.includes(type)
}