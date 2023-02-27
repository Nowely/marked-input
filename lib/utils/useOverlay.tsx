import {Mark, OverlayProps, Type} from "../types";
import {useStore} from "./index";
import {useCallback} from "react";
import {Caret} from "./Caret";
import {useSelector} from "./useSelector";

export function useOverlay() {
    const trigger = useSelector(state => state.trigger!)
    const store = useStore()

    const onClose = useCallback(() => store.bus.send(Type.ClearTrigger), [])
    const onSelect = useCallback((value: Mark) => {
        store.bus.send(Type.Select, {value, trigger})
        store.bus.send(Type.ClearTrigger)
    }, [trigger])

    const style = Caret.getAbsolutePosition()

    const overlayProps: OverlayProps = {trigger, style, onSelect, onClose, ref: store.overlayRef}
    return trigger.option.initOverlay?.(overlayProps) ?? overlayProps
}