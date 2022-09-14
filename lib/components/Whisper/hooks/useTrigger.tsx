import {useState} from "react";
import {useStore} from "../../../utils";
import {Trigger, Type} from "../../../types";
import {TriggerFinder} from "../../../utils/TriggerFinder";
import {useListener} from "../../../utils/useListener";

export const useTrigger = (): Trigger | undefined => {
    const [trigger, setTrigger] = useState<Trigger | undefined>()
    const {options} = useStore()

    useListener(Type.ClearTrigger, _ => setTrigger(undefined), [])
    useListener(Type.CheckTrigger, _ => setTrigger(TriggerFinder.find(options)), [options])

    return trigger
}