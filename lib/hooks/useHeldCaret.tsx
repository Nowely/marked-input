import {useLayoutEffect, useRef} from "react";
import {Caret} from "./useCaret";

/**
 * Holds caret position on changing data. Otherwise, it jumps to head.
 */
export const useHeldCaret = () => {
    const index = useRef(NaN)

    function update() {
        index.current = Caret.getIndex()
    }

    function restore() {
        Caret.setIndex(index.current)
        index.current = NaN
    }

    useLayoutEffect(() => {
        if (Number.isNaN(index.current)) return;
        restore()
    })

    return update
}