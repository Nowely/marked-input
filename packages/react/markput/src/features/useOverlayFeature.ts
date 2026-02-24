import {useEffect} from 'react'
import {useStore} from '../lib/hooks/useStore'
import type {Option} from '../types'

export function useOverlayFeature() {
	const store = useStore()

	// useTrigger
	useEffect(() => {
		store.controllers.trigger.enable<Option>(
			(option: Option) => option.overlay?.trigger,
			match => (store.overlayMatch = match)
		)
		return () => store.controllers.trigger.disable()
	}, [])

	// useCheckTrigger
	useEffect(() => {
		store.controllers.checkTrigger.enable()
		return () => store.controllers.checkTrigger.disable()
	}, [])
}
