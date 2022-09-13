import {onSelect, Trigger, Type} from "../../../types";
import {annotate, useStore} from "../../../utils";
import {useCallback} from "react";

export function useHandlerSelect(trigger: Trigger): onSelect {
    const {bus, pieces} = useStore()

    return useCallback(({label, value}) => {
        const {option, span, index, source} = trigger

        const annotation = annotate(option.markup, label, value)

        let foundKey
        for (let [key, value] of pieces.entries()) {
            if (value === span) {
                foundKey = key
                break
            }
        }
        let newValue = span?.slice(0, index) + annotation + span?.slice(index! + source!.length)
        if (foundKey)
            bus.send(Type.Change, {value: newValue, key: foundKey})
    }, [trigger])
}