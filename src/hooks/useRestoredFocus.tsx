import {Caret} from "./useCaret";
import {RefObject, useEffect} from "react";

//TODO bug after changing same value
export const useRestoredFocus = (caret: Caret, ref: RefObject<HTMLSpanElement>) => {
    useEffect(() => {
        if (caret.isBlurred) return
        ref.current?.focus()
        caret.restoreRightOffset()
    }, [])
}