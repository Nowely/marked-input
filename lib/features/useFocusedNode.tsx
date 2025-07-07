import {useListener} from '../utils/hooks/useListener'
import {useStore} from '../utils/hooks/useStore'

export const useFocusedNode = () => {
	const store = useStore()

	useListener('focusin', (e) => store.focus.target = e.target, [])
	useListener('focusout', _ => store.focus.target = undefined, [])
}