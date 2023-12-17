import {EVENT} from '../../../constants'
import {useStore} from '../../../utils/providers/StoreProvider'
import {TriggerFinder} from '../../../utils/classes/TriggerFinder'
import {useListener} from '../../../utils/hooks/useListener'

export const useTrigger = () => {
	const store = useStore()

	useListener(EVENT.ClearTrigger, _ => store.setState({overlayMatch: undefined}), [])
	useListener(EVENT.CheckTrigger, _ => store.setState({overlayMatch: TriggerFinder.find(store.state.options)}), [])
}