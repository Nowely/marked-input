import {Mark, OverlayProps, Type} from "../types";
import {useStore} from "./index";
import {useCallback, useRef} from "react";
import {Caret} from "./Caret";
import {useSelector} from "./useSelector";

export function useOverlay() {
    const trigger = useSelector(state => state.trigger!)
    const ref = useRef<HTMLElement>(null)
    const {bus} = useStore()

    const onClose = useCallback(() => bus.send(Type.ClearTrigger), [])
    const onSelect = useCallback((value: Mark) => {
        bus.send(Type.Select, {value, trigger})
        bus.send(Type.ClearTrigger)
    }, [trigger])
    const style = Caret.getAbsolutePosition()

    const overlayProps: OverlayProps = {trigger, style, onSelect, onClose, ref}
    return trigger.option.initOverlay?.(overlayProps) ?? overlayProps
}