import {FocusEvent, KeyboardEvent, RefObject, useRef, useState} from "react";
import {Caret, useCaret} from "./useCaret";
import {KEY} from "../constants";
import {genHash, useStore} from "../utils";
import {Type} from "../types";
import {useRestoredFocusAndCaretAfterDelete} from "./useRestoredFocusAndCaretAfterDelete";

//TODO rename focusedIndex
export const useFocus = (check: () => void, clear: () => void) => {
    const caret = useCaret()

    //TODO remove current property
    const refMap = {current: new Map<number, RefObject<HTMLSpanElement>>()}

    const {dispatch, sliceMap} = useStore()
    const keys = [...sliceMap.keys()]

    const focusedIndex = useRef<number | null>(null)

    const keyRestoredElement = useRestoredFocusAndCaretAfterDelete(caret, refMap)

    const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
        const target = event.target as HTMLSpanElement
        const caretIndex = Caret.getCaretIndex(target);
        const isStartCaret = caretIndex === 0;
        const isEndCaret = caretIndex === target.textContent?.length;
        const handleMap = {
            [KEY.LEFT]: isStartCaret ? handlePressLeft : null,
            [KEY.RIGHT]: isEndCaret ? handlePressRight : null,
            [KEY.UP]: null, //TODO to the start input position
            [KEY.DOWN]: null, //TODO to the end input position
            [KEY.DELETE]: isEndCaret ? handlePressDelete : null, //TODO reverse backspace
            [KEY.BACKSPACE]: isStartCaret ? handlePressBackspace : null,
        }

        handleMap[event.key]?.()

        function handlePressLeft() {
            if (focusedIndex.current && focusedIndex.current !== 0) {
                let a = getValues()[focusedIndex.current - 1].current
                a?.focus()
                // @ts-ignore
                Caret.setCaretToEnd(a)
            }
            event.preventDefault()
        }

        function handlePressRight() {
            if (focusedIndex.current !== null && focusedIndex.current !== [...refMap.current.values()].length - 1) {
                getValues()[focusedIndex.current + 1].current?.focus()
            }
            event.preventDefault()
        }

        function handlePressBackspace() {
            if (focusedIndex.current && focusedIndex.current > 0) {
                keyRestoredElement.current = predictLeftKey()
                let currentKey = [...refMap.current.keys()][focusedIndex.current]
                let index = keys.indexOf(currentKey)
                dispatch(Type.Delete, {key: keys[index - 1]})
            }
        }

        function handlePressDelete() {
            if (focusedIndex.current !== null && focusedIndex.current !== [...refMap.current.values()].length - 1) {
                keyRestoredElement.current = predictRightKey()
                let currentKey = [...refMap.current.keys()][focusedIndex.current]
                let index = keys.indexOf(currentKey)
                dispatch(Type.Delete, {key: keys[index + 1]})
            }
        }
    }

    function predictLeftKey() {
        if (focusedIndex.current === null) return null

        let previousKey = [...refMap.current.keys()][focusedIndex.current - 1]
        let currentKey = [...refMap.current.keys()][focusedIndex.current]

        let previousText = refMap.current.get(previousKey)?.current?.textContent!
        let currentText = refMap.current.get(currentKey)?.current?.textContent!

        let newText = previousText + currentText

        caret.setPosition(previousText.length)

        return genHash(newText)
    }

    function predictRightKey() {
        if (focusedIndex.current === null) return null

        let nextKey = [...refMap.current.keys()][focusedIndex.current + 1]
        let currentKey = [...refMap.current.keys()][focusedIndex.current]

        let nextText = refMap.current.get(nextKey)?.current?.textContent!
        let currentText = refMap.current.get(currentKey)?.current?.textContent!

        let newText = currentText + nextText

        caret.setPosition(currentText.length)

        return genHash(newText)
    }

    function getValues() {
        return [...refMap.current.values()]
    }

    return {
        register: (key: number) => (ref: RefObject<HTMLSpanElement>) => refMap.current.set(key, ref),
        onFocus: (event: FocusEvent<HTMLElement>) => {
            document.addEventListener("selectionchange", check)
            focusedIndex.current = [...refMap.current.values()].findIndex(value => value.current === event.target)
        },
        onBlur: () => {
            document?.removeEventListener("selectionchange", check);
            //TODO. It is for overlay click correct handling
            setTimeout(_ => clear(), 200)
            focusedIndex.current = null;
        },
        onClick: () => {
            if (refMap.current.size === 1){
                const element = [...refMap.current.values()][0].current
                if (element?.textContent === ""){
                    element.focus()
                }
            }
        },
        onKeyDown,
    }
}

