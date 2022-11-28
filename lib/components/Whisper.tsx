import {memo} from "react";
import {useSelector} from "../utils/useSelector";
import {Suggestions} from "./Suggestions";

export const Whisper = memo(() => {
    const trigger = useSelector(state => state.trigger)
    const Overlay = useSelector(state => state.Overlay ?? Suggestions)

    return trigger ? <Overlay key={trigger.option.index}/> : null;
})

Whisper.displayName = 'Whisper'