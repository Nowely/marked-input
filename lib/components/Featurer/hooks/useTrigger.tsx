import {Type} from "../../../types"
import {useStore} from "../../../utils"
import {TriggerFinder} from "../../../utils/TriggerFinder"
import {useListener} from "../../../utils/useListener"

export const useTrigger = () => {
    const store = useStore()

    useListener(Type.ClearTrigger, _ => store.setState({trigger: undefined}), [])
    useListener(Type.CheckTrigger, _ => store.setState({trigger: TriggerFinder.find(store.state.options)}), [])
}