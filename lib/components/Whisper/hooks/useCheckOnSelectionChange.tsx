import {debounce, useStore} from "../../../utils";
import {FocusEvent, useCallback} from "react";
import {Type} from "../../../types";
import {useListener} from "../../../utils/useListener";

export function useCheckOnSelectionChange() {
    const {bus} = useStore()

    const sendCheckTrigger = useCallback(debounce(() => bus.send(Type.CheckTrigger), 20), [])

    useListener("onFocus", (e: FocusEvent<HTMLElement>) =>
        document.addEventListener("selectionchange", sendCheckTrigger, {}), [])

    useListener("onBlur", (e: FocusEvent<HTMLElement>) =>
        document.removeEventListener("selectionchange", sendCheckTrigger), [])
}