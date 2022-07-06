import {RefObject, useLayoutEffect, useRef} from "react";
import {Caret} from "./useCaret";

/**
 * Holds caret position on changing data. Otherwise, it jumps to head.
 */
export const useHeldCaret = (ref: RefObject<HTMLSpanElement>) => {
    const index = useRef(NaN)

    function update() {
        if (!ref.current) return
        index.current = Caret.getCaretIndex(ref.current)
    }

    function restore() {
        if (!ref.current) return
        Caret.setIndex(index.current)
        index.current = NaN
    }

    useLayoutEffect(() => {
        if (Number.isNaN(index.current)) return;
        restore()
    })

    return update
}