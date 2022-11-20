import {RefObject, useEffect, useRef} from "react";
import {Caret} from "../../../../../utils/Caret";
import {NodeData} from "../../../../../types";
import {useSelector} from "../../../../../utils/useSelector";

//TODO move to types
export type Recovery = {
    prevNodeData?: NodeData
    caretPosition: number
}

export const useRecoveryAfterRemove = () => {
    const pieces = useSelector(state => state.pieces)
    const recoveryRef = useRef<Recovery | null>(null)

    //Restore focus after delete mark
    useEffect(() => {
        if (recoveryRef.current) {
            const {prevNodeData, caretPosition} = recoveryRef.current

            const node = pieces.findNode(data => data === prevNodeData)
            const newNode = node?.next ?? pieces.head
            const element = newNode?.data.ref?.current
            element?.focus()

            if (element)
                Caret.trySetIndex(element, caretPosition)

            recoveryRef.current = null
        }
    })

    return recoveryRef
}