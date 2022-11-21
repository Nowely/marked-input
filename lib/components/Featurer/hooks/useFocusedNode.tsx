import {FocusEvent} from "react";
import {useListener} from "../../../utils/useListener";
import {useStore} from "../../../utils";

export const useFocusedNode = () => {
    const store = useStore()

    useListener("onFocus", (e: FocusEvent<HTMLElement>) =>
        store.focusedNode = store.state.pieces.findNode(data => data.ref?.current === e.target), [])
    useListener("onBlur", _ => store.focusedNode = undefined, [])
};