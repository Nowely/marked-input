import {useEffect} from 'react'
import {useStore} from '../utils/hooks/useStore'

export const useFocusRecovery = () => {
	const store = useStore()
	const tokens = useStore(store => store.tokens)
	const deps = store.props.Mark ? [tokens] : undefined

	//Restore focus after delete mark
	useEffect(() => {
		if (!store.recovery) return

		const {anchor, caret} = store.recovery

		switch (true) {
			case !anchor.target:
				store.focus.head.focus()
				break
			default:
				anchor.next.focus()
		}

		store.focus.caret = caret
		store.recovery = undefined
	}, deps)
}