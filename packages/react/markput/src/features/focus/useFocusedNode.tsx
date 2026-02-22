import {useEffect} from 'react'
import {useStore} from '../../lib/hooks/useStore'

export const useFocusedNode = () => {
	const store = useStore()

	useEffect(() => {
		store.controllers.focus.enable()
		return () => store.controllers.focus.disable()
	}, [])
}
