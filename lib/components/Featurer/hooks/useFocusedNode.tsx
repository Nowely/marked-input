import {useListener} from '../../../utils/hooks/useListener'
import {useStore} from '../../../utils/providers/StoreProvider'

export const useFocusedNode = () => {
	const store = useStore()

	useListener('focusin', (e) =>
		store.focusedNode = store.state.pieces.findNode(data => data.ref.current === e.target), [])
	useListener('focusout', _ => store.focusedNode = undefined, [])
}