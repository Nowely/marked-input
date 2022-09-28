import {KeyboardEvent, MutableRefObject, RefObject, useEffect} from "react";
import {Caret} from "../../../../../utils/Caret";
import {KEY} from "../../../../../constants";
import {Type} from "../../../../../types";
import {useStore, usePieces} from "../../../../../utils";
import {Recovery} from "./useRecoveryAfterRemove";
import {Oracle} from "../../../../../utils/Oracle";
import {useListener} from "../../../../../utils/useListener";

//TODO clean up
export function useKeyDown(
    spanRefs: Map<number, RefObject<HTMLElement>>,
    recoveryRef: MutableRefObject<Recovery | null>,
    focusedSpanRef: MutableRefObject<HTMLElement | null>
) {
    const {bus} = useStore()
    const pieces = usePieces()

    //TODO fix broken this because of pieces
    useListener("onKeyDown", (event: KeyboardEvent<HTMLSpanElement>) => {
        const oracle = new Oracle(focusedSpanRef, spanRefs, recoveryRef, pieces)
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
            const element = oracle.getPreviousElement()
            element?.focus()
            Caret.setCaretToEnd(element)
            event.preventDefault()
        }

        function handlePressRight() {
            const element = oracle.getNextElement()
            element?.focus()
            event.preventDefault()
        }

        function handlePressBackspace() {
            const key = oracle.getPreviousMarkKey()
            if (!key) return

            oracle.recoverLeft()
            bus.send(Type.Delete, {key})
            event.preventDefault()
        }

        function handlePressDelete() {
            const key = oracle.getNextMarkKey()
            if (!key) return

            oracle.recoverRight()
            bus.send(Type.Delete, {key})
            event.preventDefault()
        }
    }, [pieces])
}