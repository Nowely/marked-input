import {useEffect} from 'react'
import {useStore} from '../../lib/hooks/useStore'

export function useCloseOverlayByOutsideClick() {
	const store = useStore()
	const match = useStore(s => s.overlayMatch, true)

	useEffect(() => {
		if (!match) return
		store.controllers.closeOverlay.enable()
		return () => store.controllers.closeOverlay.disable()
	}, [match])
}
