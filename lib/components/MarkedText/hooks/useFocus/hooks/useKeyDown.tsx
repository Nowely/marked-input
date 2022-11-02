import {KeyboardEvent, MutableRefObject} from "react";
import {Caret} from "../../../../../utils/Caret";
import {KEY} from "../../../../../constants";
import {NodeData, Type} from "../../../../../types";
import {useStore} from "../../../../../utils";
import {Recovery} from "./useRecoveryAfterRemove";
import LinkedListNode from "../../../../../utils/LinkedListNode";
import {useDownOf} from "./useDownOf";

export function useKeyDown(
    recoveryRef: MutableRefObject<Recovery | null>,
    focusedNodeRef: MutableRefObject<LinkedListNode<NodeData> | undefined>
) {
    const {bus} = useStore()

    useDownOf(KEY.LEFT, event => {
        if (!isCaretInStart(event)) return

        const node = focusedNodeRef.current?.prev
        const element = node?.data.ref?.current ?? node?.prev?.data.ref?.current
        element?.focus()
        Caret.setCaretToEnd(element)
        event.preventDefault()
    })

    useDownOf(KEY.RIGHT, event => {
        if (!isCaretInEnd(event)) return

        const node = focusedNodeRef.current?.next
        const element = node?.data.ref?.current ?? node?.next?.data.ref?.current
        element?.focus()
        event.preventDefault()
    })

    useDownOf(KEY.DELETE, event => {
        if (!isCaretInEnd(event)) return

        const node = focusedNodeRef.current?.next
        if (!node?.data.key) return

        const caretPosition = node.prev?.data.mark.label.length ?? 0
        recoveryRef.current = {prevNodeData: node.prev?.prev?.data, caretPosition}
        bus.send(Type.Delete, {key: node.data.key})
        event.preventDefault()
    })

    useDownOf(KEY.BACKSPACE, event => {
        if (!isCaretInStart(event)) return

        const node = focusedNodeRef.current?.prev
        if (!node?.data.key) return

        const caretPosition = node.prev?.data.mark.label.length ?? 0
        recoveryRef.current = {prevNodeData: node.prev?.prev?.data, caretPosition}
        bus.send(Type.Delete, {key: node.data.key})
        event.preventDefault()
    })
}

function isCaretInStart(e: KeyboardEvent<HTMLSpanElement>) {
    const target = e.target as HTMLSpanElement
    const caretIndex = Caret.getCaretIndex(target);
    return caretIndex === 0;
}

function isCaretInEnd(event: KeyboardEvent<HTMLSpanElement>) {
    const target = event.target as HTMLSpanElement
    const caretIndex = Caret.getCaretIndex(target);
    return caretIndex === target.textContent?.length;
}
