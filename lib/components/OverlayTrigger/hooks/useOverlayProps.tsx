import {Mark, MarkProps, OverlayProps, Trigger, Type} from "../../../types";
import {useStore} from "../../../utils";
import {useCallback} from "react";
import {Caret} from "../../../utils/Caret";

export function useOverlayProps(trigger: Trigger) {
    const {bus} = useStore()

    const onClose = useCallback(() => bus.send(Type.ClearTrigger), [])
    const onSelect = useCallback((value: Mark) => bus.send(Type.Select, {value, trigger}), [trigger])
    const style = Caret.getAbsolutePosition()

    const overlayProps: OverlayProps = {trigger, style, onSelect, onClose}
    return trigger.option.initOverlay?.(overlayProps) ?? overlayProps
}