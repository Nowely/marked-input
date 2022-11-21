import {useState} from "react";
import {useStore} from "../../../utils";
import {Trigger, Type} from "../../../types";
import {TriggerFinder} from "../../../utils/TriggerFinder";
import {useListener} from "../../../utils/useListener";
import {useSelector} from "../../../utils/useSelector";

export const useTrigger = (): Trigger | undefined => {
    const [trigger, setTrigger] = useState<Trigger | undefined>()
    const options = useSelector(state => state.options)

    useListener(Type.ClearTrigger, _ => setTrigger(undefined), [])
    useListener(Type.CheckTrigger, _ => setTrigger(TriggerFinder.find(options)), [options])

    return trigger
}