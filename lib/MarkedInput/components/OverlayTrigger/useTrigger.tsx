import React, {useCallback, useState} from "react";
import {useStore} from "../../utils";
import {Trigger} from "../../types";
import {useCheckOnSelectionChange} from "./useCheckOnSelectionChange";
import {TriggerFinder} from "../../utils/TriggerFinder";

export const useTrigger = (): Trigger | undefined => {
    const [trigger, setTrigger] = useState<Trigger | undefined>()
    const {options} = useStore()

    const clear = useCallback(() => setTrigger(undefined), [])
    const check = useCallback(() => setTrigger(TriggerFinder.find(options)), [options])

    useCheckOnSelectionChange(check, clear)

    return trigger
}


