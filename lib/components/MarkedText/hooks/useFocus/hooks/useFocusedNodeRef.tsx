import {FocusEvent, useRef} from "react";
import {useListener} from "../../../../../utils/useListener";
import {NodeData} from "../../../../../types";
import LinkedListNode from "../../../../../utils/LinkedListNode";
import {useSelector} from "../../../../../utils/useSelector";

export const useFocusedNodeRef = () => {
    const pieces = useSelector(state => state.pieces)
    const ref = useRef<LinkedListNode<NodeData> | undefined>()

    useListener("onFocus", (e: FocusEvent<HTMLElement>) =>
        ref.current = pieces.findNode(data => data.ref?.current === e.target), [pieces])
    useListener("onBlur", _ => ref.current = undefined, [])

    return ref
};