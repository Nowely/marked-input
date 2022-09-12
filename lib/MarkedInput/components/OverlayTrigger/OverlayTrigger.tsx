import {annotate, useStore} from "../../utils";
import {Suggestion} from "../../Suggestion";
import React, {createElement} from "react";
import {onSelect, OverlayProps, Type} from "../../types";
import {useTrigger} from "./useTrigger";
import {Caret} from "../../utils/Caret";

export const OverlayTrigger = () => {
    const {pieces, bus, props: {Overlay = Suggestion}} = useStore()
    const trigger = useTrigger()

    if (!trigger) return null

    const {value, option, span, index, source} = trigger
    const style = Caret.getAbsolutePosition()

    const onSelect: onSelect = ({label, value}) => {
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
    }

    const triggerProps: OverlayProps = {word: value, style, onSelect, data: option.data}
    //TODO
    const overlayProps = option.initOverlay?.(triggerProps) ?? triggerProps
    return createElement(Overlay, overlayProps);
}