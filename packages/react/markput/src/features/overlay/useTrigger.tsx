import {useStore} from '../../lib/hooks/useStore'
import type {Option} from '../../types'
import {useEffect} from 'react'

export const useTrigger = () => {
	const store = useStore()

	useEffect(() => {
		store.controllers.trigger.enable<Option>(
			(option: Option) => option.overlay?.trigger,
			match => (store.overlayMatch = match)
		)
		return () => store.controllers.trigger.disable()
	}, [])
}
