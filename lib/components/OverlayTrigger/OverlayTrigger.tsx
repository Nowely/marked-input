import {isForward, useStore} from "../../utils";
import {Suggestions} from "../Suggestions";
import {Trigger} from "../../types";
import {useOverlayProps} from "./useOverlayProps";
import {useSelector} from "../../utils/useSelector";

export const OverlayTrigger = (trigger: Trigger) => {
    const store = useStore()

    const props = useOverlayProps(trigger)
    const Overlay = useSelector(state => state.Overlay ?? Suggestions)

    return <Overlay ref={isForward(Overlay) ? store.overlayRef : undefined} {...props} />
}