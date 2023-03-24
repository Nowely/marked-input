import {FocusEvent} from 'react'
import {useStore} from '../../../utils'
import {useContainerListener} from '../../../utils/useListener'

export const useFocusedNode = () => {
	const store = useStore()

	useContainerListener('focusin', (e: FocusEvent<HTMLElement>) =>
		store.focusedNode = store.state.pieces.findNode(data => data.ref.current === e.target), [])
	useContainerListener('focusout', _ => store.focusedNode = undefined, [])
}