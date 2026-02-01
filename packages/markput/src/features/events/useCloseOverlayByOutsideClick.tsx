import {useEffect} from 'react'
import {useStore} from '../../lib/hooks/useStore'
import {SystemEvent} from '@markput/core'

export function useCloseOverlayByOutsideClick() {
	const store = useStore()
	const match = useStore(store => store.overlayMatch)

	useEffect(() => {
		if (!match) return

		const handleClick = (event: MouseEvent) => {
			const target = event.target as HTMLElement | null
			if (store.refs.overlay?.contains(target) || store.refs.container?.contains(target)) return
			store.bus.send(SystemEvent.ClearTrigger)
		}

		document.addEventListener('click', handleClick)
		return () => document.removeEventListener('click', handleClick)
	}, [match])
}
