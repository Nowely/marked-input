import {annotate, useStore} from "../utils";
import {Suggestion} from "../Suggestion";
import React, {createElement} from "react";
import {onSelect, OverlayProps, Type} from "../types";

export const OverlayTrigger = () => {
    const {sliceMap, trigger: {word, config, style, text, indexBefore, triggeredValue}, dispatch, props: {Overlay = Suggestion}} = useStore()

    if (word === undefined) return null;

    const onSelect: onSelect = ({id, value}) => {
        const annotation = annotate(config.markup, value, id)
        let foundKey
        for (let [key, value] of sliceMap.entries()) {
            if (value === text) {
                foundKey = key
                break
            }
        }
        let newValue = text?.slice(0, indexBefore) + annotation + text?.slice(indexBefore! + triggeredValue!.length)
        if (foundKey)
        dispatch(Type.Change, {value: newValue, key: foundKey})
    }

    const triggerProps: OverlayProps = {word, style, onSelect, data: config.data ?? []}
    //TODO
    const overlayProps = config.initOverlay?.(triggerProps) ?? triggerProps
    return createElement(Overlay, overlayProps);
}