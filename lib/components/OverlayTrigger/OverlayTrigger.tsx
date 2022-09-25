import {useStore} from "../../utils";
import {Suggestions} from "../Suggestions";
import React, {useRef} from "react";
import {Trigger} from "../../types";
import {useOverlayProps} from "./hooks/useOverlayProps";
import {useCloseByClickOutside} from "./hooks/useCloseByClickOutside";
import {useCloseByEsc} from "./hooks/useCloseByEsc";

export const OverlayTrigger = (trigger: Trigger) => {
    const ref = useRef<HTMLElement>(null)

    useCloseByEsc()
    useCloseByClickOutside(ref)

    const props = useOverlayProps(trigger)
    const {props: {overlay: {Overlay}}} = useStore()

    return <Overlay ref={ref} {...props} />
}