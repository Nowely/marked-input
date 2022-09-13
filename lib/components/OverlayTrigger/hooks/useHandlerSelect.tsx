import {onSelect, Trigger, Type} from "../../../types";
import {annotate, useStore} from "../../../utils";
import {useCallback} from "react";

//TODO remove pieces dependencies
export function useHandlerSelect(trigger: Trigger): onSelect {
    const {bus, pieces} = useStore()

    return useCallback(({label, value}) => {
        const {option, span, index, source} = trigger

        const annotation = annotate(option.markup, label, value)
        let newValue = span?.slice(0, index) + annotation + span?.slice(index! + source!.length)

        let foundKey
        for (let [key, piece] of pieces.entries()) {
            if (piece === span) {
                foundKey = key
                break
            }
        }

        if (foundKey)
            bus.send(Type.Change, {value: newValue, key: foundKey})
    }, [trigger, pieces])
}