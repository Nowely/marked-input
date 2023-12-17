import {SystemEvent} from '../../../constants'
import {useStore} from '../../../utils/providers/StoreProvider'
import {TriggerFinder} from '../../../utils/classes/TriggerFinder'
import {useListener} from '../../../utils/hooks/useListener'

export const useTrigger = () => {
	const store = useStore()

	useListener(SystemEvent.ClearTrigger, _ => store.overlayMatch = undefined, [])
	useListener(SystemEvent.CheckTrigger, _ => store.overlayMatch = TriggerFinder.find(store.props.options), [])
}