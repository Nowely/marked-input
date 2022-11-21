import {OverlayTrigger} from "./OverlayTrigger";
import {memo} from "react";
import {useProps} from "../utils/useProps";

export const Whisper = memo(() => {
    const trigger = useProps(state => state.trigger)

    if (trigger) return <OverlayTrigger key={trigger.option.index} {...trigger}/>
    return null
})

Whisper.displayName = 'Whisper'