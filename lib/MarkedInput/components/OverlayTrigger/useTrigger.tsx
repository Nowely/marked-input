import React, {useCallback, useState} from "react";
import {useStore} from "../../utils";
import {OptionType} from "../../types";
import {useCheckOnSelectionChange} from "./useCheckOnSelectionChange";
import {TriggerFinder} from "../../utils/TriggerFinder";

export type Trigger = {
    word: string,
    triggeredValue: string | undefined,
    text: string | undefined,
    index: number | undefined,
    option: OptionType,
    style: {
        left: number,
        top: number
    }
}

//TODO reducer?
export const useTrigger = (): Trigger | undefined => {
    const [trigger, setTrigger] = useState<Trigger | undefined>()
    const {options} = useStore()

    const clear = useCallback(() => setTrigger(undefined), [])
    const check = useCallback(() => setTrigger(TriggerFinder.find(options)), [options])

    useCheckOnSelectionChange(check, clear)

    return trigger
}


