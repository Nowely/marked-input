import {OverlayTrigger} from "./OverlayTrigger";
import {memo} from "react";
import {useSelector} from "../utils/useSelector";

export const Whisper = memo(() => {
    const trigger = useSelector(state => state.trigger)

    if (trigger) return <OverlayTrigger key={trigger.option.index} {...trigger}/>
    return null
})

Whisper.displayName = 'Whisper'