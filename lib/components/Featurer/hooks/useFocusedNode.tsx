import {useListener} from '../../../utils/hooks/useListener'
import {useStore} from '../../../utils/hooks/useStore'

export const useFocusedNode = () => {
	const store = useStore()

	useListener('focusin', (e) => store.nodes.focused = e.target as HTMLElement, [])
	useListener('focusout', _ => store.nodes.focused = undefined, [])
}