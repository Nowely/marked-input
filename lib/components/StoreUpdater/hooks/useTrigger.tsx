import {Type} from "../../../types";
import {TriggerFinder} from "../../../utils/TriggerFinder";
import {useListener} from "../../../utils/useListener";
import {useStore} from "../../../utils";

export const useTrigger = () => {
    const store = useStore()

    useListener(Type.ClearTrigger, _ => store.setState({trigger: undefined}), [])
    useListener(Type.CheckTrigger, _ => store.setState({trigger: TriggerFinder.find(store.state.options)}), [])
}