import {useCallback} from 'react'
import {SystemEvent} from '../../../constants'
import {OverlayTrigger} from '../../../types'
import {Store} from '../../../utils/classes/Store'
import {useListener} from '../../../utils/hooks/useListener'
import {useStore} from '../../../utils/hooks/useStore'

export function useCheckTrigger() {
	const store = useStore()

	const sendCheckTrigger = useCallback((e: Event) =>
		isMatch(e, store) && store.bus.send(SystemEvent.CheckTrigger), [])

	useListener('focusin', () =>
		document.addEventListener('selectionchange', sendCheckTrigger), [])

	useListener('focusout', () =>
		document.removeEventListener('selectionchange', sendCheckTrigger), [])

	useListener(SystemEvent.Change, sendCheckTrigger, [])
}


function isMatch(e: Event, store: Store) {
	let trigger = store.props.trigger ?? 'change'
	let type: OverlayTrigger

	if ('key' in e) type = 'change'
	else type = 'selectionChange'

	return trigger === type || trigger.includes(type)
}