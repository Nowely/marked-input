import {useState} from "react";
import {Trigger, Type} from "../../../types";
import {TriggerFinder} from "../../../utils/TriggerFinder";
import {useListener} from "../../../utils/useListener";
import {useProps} from "../../../utils/useProps";
import {useStore} from "../../../utils";

export const useTrigger = (): Trigger | undefined => {
    const store = useStore()
    const [trigger, setTrigger] = useState<Trigger | undefined>()

    useListener(Type.ClearTrigger, _ => setTrigger(undefined), [])
    useListener(Type.CheckTrigger, _ => setTrigger(TriggerFinder.find(store.state.options)), [])

    return trigger
}