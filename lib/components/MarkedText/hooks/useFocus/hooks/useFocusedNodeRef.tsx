import {FocusEvent, useRef} from "react";
import {useListener} from "../../../../../utils/useListener";
import {useValue} from "../../../../../utils";
import {NodeData} from "../../../../../types";
import LinkedListNode from "../../../../../utils/LinkedListNode";

export const useFocusedNodeRef = () => {
    const list = useValue()
    const ref = useRef<LinkedListNode<NodeData> | undefined>()

    useListener("onFocus", (e: FocusEvent<HTMLElement>) =>
        ref.current = list.findNode(data => data.ref?.current === e.target), [list])
    useListener("onBlur", _ => ref.current = undefined, [])

    return ref
};