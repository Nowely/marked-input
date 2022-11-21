import {RefObject, useEffect, useRef} from "react";
import {Caret} from "../../utils/Caret";
import {NodeData} from "../../types";
import {useProps} from "../../utils/useProps";
import {useStore} from "../../utils";

//TODO move to types
export type Recovery = {
    prevNodeData?: NodeData
    caretPosition: number
    isPrevPrev?: boolean
}

export const useFocusRecovery = () => {
    const store = useStore()

    //Restore focus after delete mark
    useEffect(() => {
        if (store.recovery) {
            const {prevNodeData, caretPosition, isPrevPrev} = store.recovery

            const node = store.state.pieces.findNode(data => data === prevNodeData)
            const newNode = isPrevPrev
                ? node?.next?.next?.next ?? store.state.pieces.head?.next?.next
                : node?.next ?? store.state.pieces.head
            const element = newNode?.data.ref?.current
            element?.focus()

            if (element)
                Caret.trySetIndex(element, caretPosition)

            store.recovery = undefined
        }
    })
}