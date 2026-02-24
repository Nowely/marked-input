import {useEffect} from 'react'
import {useStore} from '../../lib/hooks/useStore'

export function useTextSelection() {
	const store = useStore()

	useEffect(() => {
		store.controllers.textSelection.enable()
		return () => store.controllers.textSelection.disable()
	}, [])
}
