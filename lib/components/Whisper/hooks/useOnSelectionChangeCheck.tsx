import {debounce, useStore} from "../../../utils";
import {FocusEvent, useCallback, useEffect} from "react";
import {Type} from "../../../types";

export function useOnSelectionChangeCheck() {
    const {bus} = useStore()

    const sendCheckTrigger = useCallback(debounce(() => bus.send(Type.CheckTrigger), 20), [])

    useEffect(() => bus.listen("onFocus", (e: FocusEvent<HTMLElement>) =>
        document.addEventListener("selectionchange", sendCheckTrigger, {})), [])

    useEffect(() => bus.listen("onBlur", (e: FocusEvent<HTMLElement>) =>
        document.removeEventListener("selectionchange", sendCheckTrigger)), [])
}