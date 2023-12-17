import {useListener} from '../../../utils/hooks/useListener'
import {useStore} from '../../../utils/hooks/useStore'

export const useFocusedNode = () => {
	const store = useStore()

	useListener('focusin', (e) =>
		store.focusedNode = store.pieces.findNode(data => data.ref.current === e.target), [])
	useListener('focusout', _ => store.focusedNode = undefined, [])
}