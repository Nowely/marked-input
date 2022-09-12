import {annotate, useStore} from "../../utils";
import {Suggestions} from "../Suggestions";
import React, {createElement, useCallback, useEffect, useRef} from "react";
import {onSelect, OverlayProps, Type} from "../../types";
import {useTrigger} from "./useTrigger";
import {Caret} from "../../utils/Caret";

//TODO clean up
export const OverlayTrigger = () => {
    const {pieces, bus, props: {Overlay = Suggestions}} = useStore()
    const trigger = useTrigger()

    const ref = useRef<HTMLDivElement>(null)

    //on document listener
    /*const handleDocumentKeyUp = useCallback((event: React.KeyboardEvent) => {
        if (listenEscape && event.key === KEY.ESC)
            onRootClose?.(event);
    }, [listenEscape, onRootClose]);*/

    //TODO check for no ref component
    useEffect(() => {
        if (!trigger) return
        const x = (event: MouseEvent) => {
            if (event.target === ref.current) return
            if (event.target === bus.get("TextRef").current) return
            //TODO
            //@ts-ignore
            if (event.target?.parentElement === bus.get("TextRef").current) return

            bus.send(Type.ClearTrigger)
        }
        document.addEventListener("click", x)
        return () => document.removeEventListener("click", x)
    }, [trigger])

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

    //const onClose = useCallback(() => bus.send(Type.ClearTrigger), [])
    const onClose = () => bus.send(Type.ClearTrigger)

    //const triggerProps1: OverlayProps = {word: value, style, onSelect, onClose, data: option.data}
    const triggerProps: OverlayProps = {trigger, style, onSelect, onClose}
    //TODO
    const overlayProps = option.initOverlay?.(triggerProps) ?? triggerProps

    return <Overlay ref={ref} {...overlayProps} />

    //createElement(Overlay, overlayProps);
}
