import {SystemEvent} from '../../../constants'
import {TriggerFinder} from '../../../utils/classes/TriggerFinder'
import {useListener} from '../../../utils/hooks/useListener'
import {useStore} from '../../../utils/hooks/useStore'

export const useTrigger = () => {
	const store = useStore()

	useListener(SystemEvent.ClearTrigger, _ => store.overlayMatch = undefined, [])
	useListener(SystemEvent.CheckTrigger, _ => store.overlayMatch = TriggerFinder.find(store.props.options), [])
}