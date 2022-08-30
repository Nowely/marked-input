import {RefObject, useEffect, useRef} from "react";
import {Caret} from "../../../utils/Caret";

export const useRestoredFocusAndCaretAfterDelete = (caret: Caret, refMap: Map<number, RefObject<HTMLSpanElement>>) => {
    const predictedKey = useRef<number | null>(null)

    //Restore focus after delete mark
    useEffect(() => {
        if (predictedKey.current) {
            let refSpan = refMap.get(predictedKey.current)?.current!
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