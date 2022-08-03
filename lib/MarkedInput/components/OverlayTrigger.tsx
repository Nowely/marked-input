import {useStore} from "../utils";
import {Suggestion} from "../Suggestion";
import React, {createElement} from "react";

export const OverlayTrigger = () => {
    const {trigger: {word, configRef}, props: {Overlay = Suggestion}} = useStore()
    let configs: any

    if (!word) return null;

    const triggerProps = {word, left: 0, top: 0, onClose: configs}
    //TODO
    const overlayProps = configRef.current?.initOverlay?.(triggerProps, configs) ?? triggerProps
    return createElement(Overlay, overlayProps);
}