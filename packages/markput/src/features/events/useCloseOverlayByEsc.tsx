import {useEffect} from 'react'
import {useStore} from '../../utils/hooks/useStore'
import {KEYBOARD, SystemEvent} from '@markput/core'

export function useCloseOverlayByEsc() {
	const {match, bus} = useStore(
		store => ({
			match: store.overlayMatch,
			bus: store.bus,
		}),
		true
	)

	useEffect(() => {
		if (!match) return

		const handle = (event: KeyboardEvent) => {
			if (event.key === KEYBOARD.ESC) bus.send(SystemEvent.ClearTrigger)
		}

		window.addEventListener('keydown', handle)
		return () => window.removeEventListener('keydown', handle)
	}, [match])
}
