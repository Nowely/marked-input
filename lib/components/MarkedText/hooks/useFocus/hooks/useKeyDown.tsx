import {KeyboardEvent, MutableRefObject, RefObject, useEffect} from "react";
import {Caret} from "../../../../../utils/Caret";
import {KEY} from "../../../../../constants";
import {PieceNode, Type} from "../../../../../types";
import {useStore, useValue} from "../../../../../utils";
import {Recovery} from "./useRecoveryAfterRemove";
import {useListener} from "../../../../../utils/useListener";

//TODO clean up
export function useKeyDown(
    recoveryRef: MutableRefObject<Recovery | null>,
    focusedSpanRef: MutableRefObject<PieceNode | undefined>
) {
    const {bus} = useStore()
    const pieces = useValue()

    //TODO fix broken this because of pieces. Move to value provider
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
            //TODO find first with ref element
            const node = pieces.findNode(piece => piece === focusedSpanRef.current)?.prev?.prev
            Caret.setCaretToEnd(node?.data.ref?.current!)
            event.preventDefault()
        }

        function handlePressRight() {
            const node = pieces.findNode(piece => piece === focusedSpanRef.current)?.next?.next
            node?.data.ref?.current?.focus()
            event.preventDefault()
        }

        function handlePressBackspace() {
            const node = pieces.findNode(piece => piece === focusedSpanRef.current)?.prev
            if (!node?.data.key) return

            const caretPosition = typeof node.prev?.data.piece === 'string' ? node.prev?.data.piece.length : 0
            recoveryRef.current = {prevNodeData: node.prev?.prev?.data, caretPosition}
            bus.send(Type.Delete, {key: node.data.key})
            event.preventDefault()
        }

        function handlePressDelete() {
            const node = pieces.findNode(piece => piece === focusedSpanRef.current)?.next
            if (!node?.data.key) return

            const caretPosition = typeof node.prev?.data.piece === 'string' ? node.prev?.data.piece.length : 0
            recoveryRef.current = {prevNodeData: node.prev?.data, caretPosition}
            bus.send(Type.Delete, {key: node.data.key})
            event.preventDefault()
        }
    }, [pieces])
}