import {useStore} from "../utils";
import {Suggestion} from "../Suggestion";
import React, {createElement} from "react";

export const OverlayTrigger = () => {
    const {trigger: {word, configRef, stylesRef}, props: {Overlay = Suggestion}} = useStore()
    let configs: any

    if (word === undefined) return null;

    const triggerProps = {word, style: stylesRef.current, onClose: configs}
    //TODO
    const overlayProps = configRef.current?.initOverlay?.(triggerProps) ?? triggerProps
    return createElement(Overlay, overlayProps);
}