import {KeyboardEvent, MutableRefObject, RefObject, useEffect} from "react";
import {Caret} from "../../../../../utils/Caret";
import {KEY} from "../../../../../constants";
import {Type} from "../../../../../types";
import {useStore, useValue} from "../../../../../utils";
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
    const pieces = useValue()

    //TODO fix broken this because of pieces. Move to value provider
    useListener("onKeyDown", (event: KeyboardEvent<HTMLSpanElement>) => {
        //const oracle = new Oracle(focusedSpanRef, spanRefs, recoveryRef, pieces)
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
            const node = pieces.findNode(piece => piece.ref?.current === focusedSpanRef.current)?.prev?.prev
            Caret.setCaretToEnd(node?.data.ref?.current!)
            event.preventDefault()
        }

        function handlePressRight() {
            //const element = oracle.getNextElement()
            //element?.focus()
            const node = pieces.findNode(piece => piece.ref?.current === focusedSpanRef.current)?.next?.next
            node?.data.ref?.current?.focus()
            event.preventDefault()
        }

        function handlePressBackspace() {
            const node = pieces.findNode(piece => piece.ref?.current === focusedSpanRef.current)?.prev
            if (!node?.data.key) return

            //TODO
            //oracle.recoverLeft()
            bus.send(Type.Delete, {key: node.data.key})
            event.preventDefault()
        }

        function handlePressDelete() {
            const node = pieces.findNode(piece => piece.ref?.current === focusedSpanRef.current)?.next
            if (!node?.data.key) return

            //oracle.recoverRight()
            bus.send(Type.Delete, {key: node.data.key})
            event.preventDefault()
        }
    }, [pieces])
}