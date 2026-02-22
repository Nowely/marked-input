import {useEffect} from 'react'
import {useStore} from '../../lib/hooks/useStore'

export const useFocusRecovery = () => {
	const store = useStore()
	const tokens = useStore(store => store.tokens)
	const deps = store.props.Mark ? [tokens] : undefined

	useEffect(() => {
		store.controllers.focus.recover()
	}, deps)
}
