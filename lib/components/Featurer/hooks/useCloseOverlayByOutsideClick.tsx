import {useEffect} from 'react'
import {SystemEvent} from '../../../constants'
import {useStore} from '../../../utils/hooks/useStore'

export function useCloseOverlayByOutsideClick() {
	const store = useStore()
	const match = useStore(store => store.overlayMatch)

	useEffect(() => {
		if (!match) return

		const handleClick = (event: MouseEvent) => {
			let target = event.target as HTMLElement | null
			if (store.refs.overlay.current?.contains(target) || store.refs.container.current?.contains(target)) return
			store.bus.send(SystemEvent.ClearTrigger)
		}

		document.addEventListener('click', handleClick)
		return () => document.removeEventListener('click', handleClick)
	}, [match])
}