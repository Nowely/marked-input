import {KeyboardEvent, MutableRefObject, RefObject, useEffect} from "react";
import {Caret} from "../../../../../utils/Caret";
import {KEY} from "../../../../../constants";
import {NodeData, Type} from "../../../../../types";
import {useStore} from "../../../../../utils";
import {Recovery} from "./useRecoveryAfterRemove";
import {useListener} from "../../../../../utils/useListener";
import LinkedListNode from "../../../../../utils/LinkedListNode";

//TODO clean up
export function useKeyDown(
    recoveryRef: MutableRefObject<Recovery | null>,
    focusedNodeRef: MutableRefObject<LinkedListNode<NodeData> | undefined>
) {
    const {bus} = useStore()

    useListener("onKeyDown", (event: KeyboardEvent<HTMLSpanElement>) => {
        const target = event.target as HTMLSpanElement
        const caretIndex = Caret.getCaretIndex(target);
        const isStartCaret = caretIndex === 0;
        const isEndCaret = caretIndex === target.textContent?.length;

        const handleMap = {
            [KEY.LEFT]: isStartCaret ? handlePressLeft : null,
            [KEY.RIGHT]: isEndCaret ? handlePressRight : null,
            [KEY.UP]: null, //TODO to the start input position?
            [KEY.DOWN]: null, //TODO to the end input position?
            [KEY.DELETE]: isEndCaret ? handlePressDelete : null,
            [KEY.BACKSPACE]: isStartCaret ? handlePressBackspace : null,
        }

        handleMap[event.key]?.()

        function handlePressLeft() {
            const node = focusedNodeRef.current?.prev

            //TODO offset for focused text?
            /*if (node?.data.ref?.current && node.data.ref.current.textContent) {
                node.data.ref.current.focus()
                Caret.trySetIndex(node.data.ref.current, node.data.ref.current.textContent.length - 1)
            } else {*/
            const element = node?.data.ref?.current ?? node?.prev?.data.ref?.current
            Caret.setCaretToEnd(element)
            //}

            event.preventDefault()
        }

        function handlePressRight() {
            const node = focusedNodeRef.current?.next

            /*if (node?.data.ref?.current && node.data.ref.current.textContent) {
                node.data.ref.current.focus()
                Caret.trySetIndex(node.data.ref.current, 1)
            } else {*/
            const element = node?.data.ref?.current ?? node?.next?.data.ref?.current
            element?.focus()
            //}

            event.preventDefault()
        }

        function handlePressBackspace() {
            const node = focusedNodeRef.current?.prev
            if (!node?.data.key) return

            const caretPosition = node.prev?.data.piece.label.length ?? 0
            recoveryRef.current = {prevNodeData: node.prev?.prev?.data, caretPosition}
            bus.send(Type.Delete, {key: node.data.key})
            event.preventDefault()
        }

        function handlePressDelete() {
            const node = focusedNodeRef.current?.next
            if (!node?.data.key) return

            const caretPosition = node.prev?.data.piece.label.length ?? 0
            recoveryRef.current = {prevNodeData: node.prev?.prev?.data, caretPosition}
            bus.send(Type.Delete, {key: node.data.key})
            event.preventDefault()
        }
    }, [])
}