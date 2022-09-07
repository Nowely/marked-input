import {useStore} from "../../utils";
import {FocusEvent, useEffect} from "react";

export function useCheckOnSelectionChange(check: () => void, clear: () => void) {
    const {bus} = useStore()

    //TODO in here send event to bus. Check pass to bus listen

    useEffect(() => bus.listen("onFocus", (e: FocusEvent<HTMLElement>) => {
        document.addEventListener("selectionchange", check)
    }), [check])

    useEffect(() => bus.listen("onBlur", (e: FocusEvent<HTMLElement>) => {
        document.removeEventListener("selectionchange", check);
        //TODO. It is for overlay click correct handling
        setTimeout(_ => clear(), 200)
    }), [check])
}