import {useEffect} from 'react'
import {useStore} from '../utils/hooks/useStore'

export const useFocusRecovery = () => {
	const store = useStore()
	const tokens = useStore(store => store.tokens)
	const deps = store.props.Mark ? [tokens] : undefined

	//Restore focus after delete mark
	useEffect(() => {
		if (!store.recovery) return

		const {anchor, caret, isNext} = store.recovery

		switch (true) {
			case isNext && !anchor.target:
				store.focus.tail.focus()
				break
			case isNext:
				anchor.prev.focus()
				break
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