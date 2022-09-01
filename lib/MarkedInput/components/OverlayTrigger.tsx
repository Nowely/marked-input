import {annotate, useStore} from "../utils";
import {Suggestion} from "../Suggestion";
import React, {createElement} from "react";
import {onSelect, OverlayProps, Type} from "../types";

export const OverlayTrigger = () => {
    const {pieces, bus, trigger, props: {Overlay = Suggestion}} = useStore()

    if (!trigger)
        return null

    const {word, option, style, text, indexBefore, triggeredValue} = trigger
    
    if (word === undefined)
        return null

    const onSelect: onSelect = ({label, value}) => {
        const annotation = annotate(option.markup, label, value)
        let foundKey
        for (let [key, value] of pieces.entries()) {
            if (value === text) {
                foundKey = key
                break
            }
        }
        let newValue = text?.slice(0, indexBefore) + annotation + text?.slice(indexBefore! + triggeredValue!.length)
        if (foundKey)
            bus.send(Type.Change, {value: newValue, key: foundKey})
    }

    const triggerProps: OverlayProps = {word, style, onSelect, data: option.data}
    //TODO
    const overlayProps = option.initOverlay?.(triggerProps) ?? triggerProps
    return createElement(Overlay, overlayProps);
}