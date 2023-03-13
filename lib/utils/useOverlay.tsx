import {MarkStruct, Trigger, Type} from "../types";
import {useStore} from "./index";
import {RefObject, useCallback} from "react";
import {Caret} from "./Caret";
import {useSelector} from "./useSelector";

export interface OverlayProps {
    /**
     * Style with caret absolute position. Used for placing an overlay.
     */
    style: {
        left: number
        top: number
    }
    /**
     * Used for close overlay.
     */
    onClose: () => void
    /**
     * Used for insert an annotation instead a triggered value.
     */
    onSelect: (value: MarkStruct) => void
    /**
     * Trigger details
     */
    trigger: Trigger
    ref: RefObject<HTMLElement>
}

export function useOverlay(): OverlayProps {
    const store = useStore()
    const trigger = useSelector(state => state.trigger!)
    const style = Caret.getAbsolutePosition()

    const onClose = useCallback(() => store.bus.send(Type.ClearTrigger), [])
    const onSelect = useCallback((value: MarkStruct) => {
        store.bus.send(Type.Select, {value, trigger})
        store.bus.send(Type.ClearTrigger)
    }, [trigger])

    return {trigger, style, onSelect, onClose, ref: store.overlayRef}
}