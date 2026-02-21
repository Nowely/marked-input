import {useListener} from '../../lib/hooks/useListener'
import {useStore} from '../../lib/hooks/useStore'

export const useFocusedNode = () => {
	const store = useStore()

	useListener('focusin', e => (store.nodes.focus.target = e.target), [])
	useListener('focusout', _ => (store.nodes.focus.target = undefined), [])
}
