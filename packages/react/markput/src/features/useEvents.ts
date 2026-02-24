import {useEffect} from 'react'
import {useStore} from '../lib/hooks/useStore'

export function useEvents() {
	const store = useStore()

	// useKeyDown
	useEffect(() => {
		store.controllers.keydown.enable()
		return () => store.controllers.keydown.disable()
	}, [])

	// useSystemListeners
	useEffect(() => {
		store.controllers.system.enable()
		return () => store.controllers.system.disable()
	}, [])

	// useCloseOverlayByEsc
	const match = useStore(s => s.overlayMatch, true)
	useEffect(() => {
		if (!match) return
		store.controllers.closeOverlay.enable()
		return () => store.controllers.closeOverlay.disable()
	}, [match])

	// useCloseOverlayByOutsideClick
	useEffect(() => {
		if (!match) return
		store.controllers.closeOverlay.enable()
		return () => store.controllers.closeOverlay.disable()
	}, [match])
}
