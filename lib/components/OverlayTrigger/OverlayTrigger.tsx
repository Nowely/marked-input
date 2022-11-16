import {isForward, useStore} from "../../utils";
import {Suggestions} from "../Suggestions";
import React, {useRef} from "react";
import {Trigger} from "../../types";
import {useOverlayProps} from "./hooks/useOverlayProps";
import {useCloseByOutsideClick} from "./hooks/useCloseByOutsideClick";
import {useCloseByEsc} from "./hooks/useCloseByEsc";

export const OverlayTrigger = (trigger: Trigger) => {
    const ref = useRef<HTMLElement>(null)

    useCloseByEsc()
    useCloseByOutsideClick(ref)

    const props = useOverlayProps(trigger)
    const {props: {Overlay = Suggestions}} = useStore()

    return <Overlay ref={isForward(Overlay) ? ref : undefined} {...props} />
}