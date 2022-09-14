import {useTrigger} from "./hooks/useTrigger";
import {OverlayTrigger} from "../OverlayTrigger";
import {useOnSelectionChangeCheck} from "./hooks/useOnSelectionChangeCheck";

export const Whisper = () => {
    const trigger = useTrigger()

    useOnSelectionChangeCheck()

    if (trigger)
        return <OverlayTrigger {...trigger}/>

    return null
}
