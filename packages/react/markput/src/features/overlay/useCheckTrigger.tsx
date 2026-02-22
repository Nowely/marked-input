import {useEffect} from 'react'
import {useStore} from '../../lib/hooks/useStore'

export function useCheckTrigger() {
	const store = useStore()

	useEffect(() => {
		store.controllers.checkTrigger.enable()
		return () => store.controllers.checkTrigger.disable()
	}, [])
}
