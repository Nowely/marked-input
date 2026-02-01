import {useCallback} from 'react'
import {useListener} from '../../lib/hooks/useListener'
import {useStore} from '../../lib/hooks/useStore'
import type {OverlayTrigger} from '@markput/core'
import {SystemEvent} from '@markput/core'

export function useCheckTrigger() {
	const store = useStore()

	const sendCheckTrigger = useCallback(() => {
		const showOverlayOn = store.props.showOverlayOn!
		const type = 'selectionChange' satisfies OverlayTrigger

		if (showOverlayOn === type || showOverlayOn.includes(type)) store.bus.send(SystemEvent.CheckTrigger)
	}, [])

	useListener(
		'focusin',
		() => {
			document.addEventListener('selectionchange', sendCheckTrigger)
		},
		[]
	)

	useListener(
		'focusout',
		() => {
			document.removeEventListener('selectionchange', sendCheckTrigger)
		},
		[]
	)

	useListener(
		SystemEvent.Change,
		() => {
			const showOverlayOn = store.props.showOverlayOn!
			const type = 'change' satisfies OverlayTrigger

			if (showOverlayOn === type || showOverlayOn.includes(type)) store.bus.send(SystemEvent.CheckTrigger)
		},
		[]
	)
}
