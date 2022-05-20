import {MutableRefObject, RefObject, useEffect, useRef, useState} from "react";
import {Caret} from "./useCaret";

export interface Focus {
    focused: number | null
    setFocused: (focus: number | null) => void
    isTail: MutableRefObject<boolean>
    useManualFocus: (id: number, ref: RefObject<HTMLSpanElement>) => void
}

export const useFocus = (): Focus => {
    const [focused, setFocused] = useState<number | null>(null)
    const isTail = useRef(false)

    /**
     * Set focus to head or tail on press right or left button
     */
    const useManualFocus = (id: number, ref: RefObject<HTMLSpanElement>) =>
        useEffect(() => {
            if (id !== focused || !ref.current) return

            if (isTail.current) {
                ref.current.focus()
                Caret.setCaretToEnd(ref.current)
                isTail.current = false
                return;
            }

            ref.current.focus()
        }, [focused])

    return {
        focused, setFocused, isTail, useManualFocus
    }
}