import {isForward, useStore} from "../../utils";
import {Suggestions} from "../Suggestions";
import {Trigger} from "../../types";
import {useOverlayProps} from "./useOverlayProps";
import {useProps} from "../../utils/useProps";

export const OverlayTrigger = (trigger: Trigger) => {
    const store = useStore()

    const props = useOverlayProps(trigger)
    const Overlay = useProps(state => state.Overlay ?? Suggestions)

    return <Overlay ref={isForward(Overlay) ? store.overlayRef : undefined} {...props} />
}