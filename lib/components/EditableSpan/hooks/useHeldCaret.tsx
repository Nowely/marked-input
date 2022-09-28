import {RefObject, useLayoutEffect, useRef} from "react";
import {Caret} from "../../../utils/Caret";

/**
 * Holds caret position on changing data. Otherwise, it jumps to head.
 */
export const useHeldCaret = () => {
    const index = useRef(NaN)

    useLayoutEffect(() => {
        if (Number.isNaN(index.current)) return;
        restore()
    })

    return save


    function restore() {
        const el = window.getSelection()?.anchorNode
        if (el)
            Caret.trySetIndex(el, index.current)
        index.current = NaN
    }

    function save(element: HTMLElement) {
        index.current = Caret.getCaretIndex(element)
    }
}