import {useStore} from "../../utils";
import {FocusEvent, useCallback, useEffect} from "react";
import {Type} from "../../types";

export function useSelectionChangeListener() {
    const {bus} = useStore()

    const sendCheckTriggerEvent = useCallback(() => bus.send(Type.CheckTrigger), [])

    useEffect(() => bus.listen("onFocus", (e: FocusEvent<HTMLElement>) =>
        document.addEventListener("selectionchange", sendCheckTriggerEvent)), [])

    useEffect(() => bus.listen("onBlur", (e: FocusEvent<HTMLElement>) =>
        document.removeEventListener("selectionchange", sendCheckTriggerEvent)), [])
}