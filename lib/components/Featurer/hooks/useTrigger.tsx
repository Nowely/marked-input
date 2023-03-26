import {SystemEvent} from '../../../types'
import {useStore} from '../../../utils'
import {TriggerFinder} from '../../../utils/TriggerFinder'
import {useListener} from '../../../utils/useListener'

export const useTrigger = () => {
	const store = useStore()

	useListener(SystemEvent.ClearTrigger, _ => store.setState({trigger: undefined}), [])
	useListener(SystemEvent.CheckTrigger, _ => store.setState({trigger: TriggerFinder.find(store.state.options)}), [])
}