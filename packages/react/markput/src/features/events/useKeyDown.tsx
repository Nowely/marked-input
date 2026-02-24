import {useEffect} from 'react'
import {useStore} from '../../lib/hooks/useStore'

export function useKeyDown() {
	const store = useStore()

	useEffect(() => {
		store.controllers.keydown.enable()
		return () => store.controllers.keydown.disable()
	}, [])
}
