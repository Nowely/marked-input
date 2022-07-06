import {FocusEvent, KeyboardEvent, RefObject, useRef} from "react";
import {Caret} from "./useCaret";
import {KEY} from "../constants";
import {genHash, useStore} from "../utils";
import {Type} from "../types";

//TODO rename focusedIndex
export const useFocus = () => {
    //TODO remove current property
    const refMap = {current: new Map<number, RefObject<HTMLSpanElement>>()}

    const {caret, dispatch, sliceMap} = useStore()
    const keys = [...sliceMap.keys()]
    const focusedIndex = useRef<number | null>(null)
    const focusedKey = useRef<number | undefined>()

    const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
        const target = event.target as HTMLSpanElement
        const caretIndex = Caret.getCaretIndex(target);
        const isStartCaret = caretIndex === 0;
        const isEndCaret = caretIndex === target.textContent?.length;
        const handleMap = {
            [KEY.LEFT]: isStartCaret ? handlePressLeft : null,
            [KEY.RIGHT]: isEndCaret ? handlePressRight : null,
            [KEY.UP]: null, //TODO to the start input position
            [KEY.DOWN]: null, //TODO to the end input position
            [KEY.DELETE]: null, //TODO reverse backspace
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
                console.log(refMap.current.size)
                focusedKey.current = predictLeftKey()
                console.log("Saved")
                let currentKey = [...refMap.current.keys()][focusedIndex.current]
                let index = keys.indexOf(currentKey)
                dispatch(Type.Delete, {key: keys[index - 1]})
            }
        }
    }

    function predictLeftKey() {
        if (!focusedIndex.current) return

        let previousKey = [...refMap.current.keys()][focusedIndex.current - 1]
        let currentKey = [...refMap.current.keys()][focusedIndex.current]

        let previousText = refMap.current.get(previousKey)?.current?.textContent!
        let currentText = refMap.current.get(currentKey)?.current?.textContent!

        let newText = previousText + currentText

        caret.setPosition(previousText.length)

        return genHash(newText)
    }

    function getValues() {
        return [...refMap.current.values()]
    }

    return {
        mapper: (key: number) => (ref: RefObject<HTMLSpanElement>) => {
            refMap.current.set(key, ref)
        },
        handleFocus: (event: FocusEvent<HTMLElement>) => {
            focusedIndex.current = [...refMap.current.values()].findIndex(value => value.current === event.target)
        },
        handleBlur: () => {
            focusedIndex.current = null;
        },
        handleKeyDown,
        focusedKey
    }
}