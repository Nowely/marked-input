import {useEffect, useState} from "react";
import {useStore} from "../../utils";
import {Trigger, Type} from "../../types";
import {useSelectionChangeListener} from "./useSelectionChangeListener";
import {TriggerFinder} from "../../utils/TriggerFinder";

export const useTrigger = (): Trigger | undefined => {
    const [trigger, setTrigger] = useState<Trigger | undefined>()
    const {options, bus} = useStore()

    useEffect(() => bus.listen(Type.ClearTrigger, _ => setTrigger(undefined)), [])
    useEffect(() => bus.listen(Type.CheckTrigger, _ => setTrigger(TriggerFinder.find(options))), [options])

    useSelectionChangeListener()

    return trigger
}