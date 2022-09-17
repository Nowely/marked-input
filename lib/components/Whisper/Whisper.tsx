import {useTrigger} from "./hooks/useTrigger";
import {OverlayTrigger} from "../OverlayTrigger";
import {useCheckOnSelectionChange} from "./hooks/useCheckOnSelectionChange";

export const Whisper = () => {
    useCheckOnSelectionChange()

    const trigger = useTrigger()
    if (trigger) return <OverlayTrigger key={trigger.option.index} {...trigger}/>
    return null
}
