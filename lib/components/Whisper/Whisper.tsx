import {useTrigger} from "./hooks/useTrigger";
import {OverlayTrigger} from "../OverlayTrigger";
import {useCheckOnSelectionChange} from "./hooks/useCheckOnSelectionChange";
import {memo} from "react";

export const Whisper = memo(() => {
    useCheckOnSelectionChange()

    const trigger = useTrigger()
    if (trigger) return <OverlayTrigger key={trigger.option.index} {...trigger}/>
    return null
})

Whisper.displayName = 'Whisper'