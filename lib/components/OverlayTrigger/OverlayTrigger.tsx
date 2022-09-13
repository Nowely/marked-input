import {annotate, useStore} from "../../utils";
import {Suggestions} from "../Suggestions";
import React, {useCallback} from "react";
import {onSelect, OverlayProps, Trigger, Type} from "../../types";
import {useTrigger} from "./useTrigger";
import {Caret} from "../../utils/Caret";
import {useAutoClose} from "./hooks/useAutoClose";

//TODO clean up
export const OverlayTrigger = () => {
    const {bus, props: {Overlay = Suggestions}} = useStore()
    const trigger = useTrigger()

    //TODO wrap this ic component: OverlayWrapper? Whisper?
    const onClose = useCallback(() => bus.send(Type.ClearTrigger), [])
    const onSelect = useSelectHandler(trigger)
    const ref = useAutoClose(trigger, onClose)

    if (!trigger)
        return null

    const props = getOverlayProps(trigger, onClose, onSelect)
    return <Overlay ref={ref} {...props} />
}

function getOverlayProps(trigger: Trigger, onClose: () => void, onSelect: onSelect) {
    const style = Caret.getAbsolutePosition()
    const props: OverlayProps = {trigger, style, onSelect, onClose}
    return trigger.option.initOverlay?.(props) ?? props
}

function useSelectHandler(trigger: Trigger | undefined): onSelect {
    const {bus, pieces} = useStore()

    return useCallback(({label, value}) => {
        if (!trigger) return

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