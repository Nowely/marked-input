import {useCallback} from 'react'
import {SystemEvent} from '../constants'
import {OverlayTrigger} from '../types'
import {useListener} from '../utils/hooks/useListener'
import {useStore} from '../utils/hooks/useStore'

export function useCheckTrigger() {
	const store = useStore()

	const sendCheckTrigger = useCallback(() => {
		const trigger = store.props.trigger
		const type = 'selectionChange' satisfies OverlayTrigger

		if (trigger === type || trigger.includes(type))
			store.bus.send(SystemEvent.CheckTrigger)
	}, [])

	useListener('focusin', () => {
		document.addEventListener('selectionchange', sendCheckTrigger)
	}, [])

	useListener('focusout', () => {
		document.removeEventListener('selectionchange', sendCheckTrigger)
	}, [])

	useListener(SystemEvent.Change, () => {
		const trigger = store.props.trigger
		const type = 'change' satisfies OverlayTrigger

		if (trigger === type || trigger.includes(type))
			store.bus.send(SystemEvent.CheckTrigger)
	}, [])
}