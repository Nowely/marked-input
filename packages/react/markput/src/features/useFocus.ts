import {useEffect} from 'react'
import {useStore} from '../lib/hooks/useStore'

export function useFocus() {
	const store = useStore()

	// useFocusedNode
	useEffect(() => {
		store.controllers.focus.enable()
		return () => store.controllers.focus.disable()
	}, [])

	// useFocusRecovery
	const tokens = useStore(store => store.tokens)
	const deps = store.props.Mark ? [tokens] : undefined
	useEffect(() => {
		store.controllers.focus.recover()
	}, deps)

	// useTextSelection
	useEffect(() => {
		store.controllers.textSelection.enable()
		return () => store.controllers.textSelection.disable()
	}, [])
}
