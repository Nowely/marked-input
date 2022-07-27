import {Caret} from "./useCaret";
import {RefObject, useEffect, useRef} from "react";

export const useRestoredFocusAndCaretAfterDelete = (caret: Caret, refMap: { current: Map<number, RefObject<HTMLSpanElement>> }) => {
    const predictedKey = useRef<number | null>(null)

    //Restore focus after delete mark
    useEffect(() => {
        if (predictedKey.current) {
            let refSpan = refMap.current.get(predictedKey.current)?.current!
            refSpan.focus()

            let position = caret.getPosition()
            if (position && refSpan) {
                Caret.setIndex(refSpan, position)
            }

            predictedKey.current = null
        }
    })

    return predictedKey
}