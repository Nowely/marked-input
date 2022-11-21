import {useState} from "react";
import {Trigger, Type} from "../../../types";
import {TriggerFinder} from "../../../utils/TriggerFinder";
import {useListener} from "../../../utils/useListener";
import {useProps} from "../../../utils/useProps";

export const useTrigger = (): Trigger | undefined => {
    const [trigger, setTrigger] = useState<Trigger | undefined>()
    const options = useProps(state => state.options)

    useListener(Type.ClearTrigger, _ => setTrigger(undefined), [])
    useListener(Type.CheckTrigger, _ => setTrigger(TriggerFinder.find(options)), [options])

    return trigger
}