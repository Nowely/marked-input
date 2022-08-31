import {RefObject, useEffect, useRef} from "react";
import {Caret} from "../../../utils/Caret";

//TODO move to types
export type Recovery = {
    key: number
    caret: number
}

export const useRecoveryAfterRemove = (refMap: Map<number, React.RefObject<HTMLSpanElement>>) => {
    //const predictedKey = useRef<number | null>(null)
    const recoveryRef = useRef<Recovery | null>(null)

    //Restore focus after delete mark
    useEffect(() => {
        if (recoveryRef.current) {
            const {key, caret} = recoveryRef.current

            let refSpan = refMap.get(key)?.current!
            refSpan.focus()

            //let position = caret.getPosition()
            if (caret && refSpan) {
                Caret.setIndex(refSpan, caret)
            }

            recoveryRef.current = null
        }
    })

    return recoveryRef
}