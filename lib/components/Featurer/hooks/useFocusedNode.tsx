import {useStore} from '../../../utils'
import {useListener} from '../../../utils/useListener'

export const useFocusedNode = () => {
	const store = useStore()

	useListener('focusin', (e) =>
		store.focusedNode = store.state.pieces.findNode(data => data.ref.current === e.target), [])
	useListener('focusout', _ => store.focusedNode = undefined, [])
}