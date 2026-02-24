import {useEffect} from 'react'
import {useStore} from '../../lib/hooks/useStore'

export function useSystemListeners() {
	const store = useStore()

	useEffect(() => {
		store.controllers.system.enable()
		return () => store.controllers.system.disable()
	}, [])
}
