import {FocusEvent, KeyboardEvent, useRef} from "react";
import {useCaret} from "./hooks/useCaret";
import {KEY} from "../../constants";
import {genHash, useStore} from "../../utils";
import {Type} from "../../types";
import {useRestoredFocusAndCaretAfterDelete} from "./hooks/useRestoredFocusAndCaretAfterDelete";
import {useRegistration} from "./hooks/useRegistration";
import {Caret} from "../../utils/Caret";

/**
 * Remove useCaret
 * registration - done
 * currentIndex
 * restore focus and index
 * track current focus and place of caret:
 *  onFocus
 *  onBlur
 *  onClick
 * handle on key down: process left, right, up, down...
 */

//TODO rename focusedIndex
export const useFocus = (check: () => void, clear: () => void) => {
    const caret = useCaret()
    const {registered, register} = useRegistration()

    const {pieces, bus} = useStore()
    const keys = [...pieces.keys()]

    const focusedIndex = useRef<number | null>(null)

    const keyRestoredElement = useRestoredFocusAndCaretAfterDelete(caret, registered)

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
            if (focusedIndex.current !== null && focusedIndex.current !== [...registered.values()].length - 1) {
                getValues()[focusedIndex.current + 1].current?.focus()
            }
            event.preventDefault()
        }

        function handlePressBackspace() {
            if (focusedIndex.current && focusedIndex.current > 0) {
                keyRestoredElement.current = predictLeftKey()
                let currentKey = [...registered.keys()][focusedIndex.current]
                let index = keys.indexOf(currentKey)
                bus.send(Type.Delete, {key: keys[index - 1]})
            }
        }

        function handlePressDelete() {
            if (focusedIndex.current !== null && focusedIndex.current !== [...registered.values()].length - 1) {
                keyRestoredElement.current = predictRightKey()
                let currentKey = [...registered.keys()][focusedIndex.current]
                let index = keys.indexOf(currentKey)
                bus.send(Type.Delete, {key: keys[index + 1]})
            }
        }
    }

    function predictLeftKey() {
        if (focusedIndex.current === null) return null

        let previousKey = [...registered.keys()][focusedIndex.current - 1]
        let currentKey = [...registered.keys()][focusedIndex.current]

        let previousText = registered.get(previousKey)?.current?.textContent!
        let currentText = registered.get(currentKey)?.current?.textContent!

        let newText = previousText + currentText

        caret.setPosition(previousText.length)

        return genHash(newText)
    }

    function predictRightKey() {
        if (focusedIndex.current === null) return null

        let nextKey = [...registered.keys()][focusedIndex.current + 1]
        let currentKey = [...registered.keys()][focusedIndex.current]

        let nextText = registered.get(nextKey)?.current?.textContent!
        let currentText = registered.get(currentKey)?.current?.textContent!

        let newText = currentText + nextText

        caret.setPosition(currentText.length)

        return genHash(newText)
    }

    function getValues() {
        return [...registered.values()]
    }

    //TODO onFocus event incorrectly work:
    /*useEffect(() => {
        const u1 = bus.listen("onFocus", (event: FocusEvent<HTMLElement>) => {
            document.addEventListener("selectionchange", check)
            focusedIndex.current = [...registered.values()].findIndex(value => value.current === event.target)
        })

        const u2 = bus.listen("onBlur", () => {
            document?.removeEventListener("selectionchange", check);
            //TODO. It is for overlay click correct handling
            setTimeout(_ => clear(), 200)
            focusedIndex.current = null;
        })

        const u3 = bus.listen("onClick", () => {
            if (registered.size === 1) {
                const element = [...registered.values()][0].current
                if (element?.textContent === "") {
                    element.focus()
                }
            }
        })

        const u4 = bus.listen("onKeyDown", onKeyDown)

        return () => {
            u1(), u2(), u3(), u4()
        }
    })*/

    return {
        register,
        onFocus: (event: FocusEvent<HTMLElement>) => {
            document.addEventListener("selectionchange", check)
            focusedIndex.current = [...registered.values()].findIndex(value => value.current === event.target)
        },
        onBlur: () => {
            document?.removeEventListener("selectionchange", check);
            //TODO. It is for overlay click correct handling
            setTimeout(_ => clear(), 200)
            focusedIndex.current = null;
        },
        onClick: () => {
            if (registered.size === 1) {
                const element = [...registered.values()][0].current
                if (element?.textContent === "") {
                    element.focus()
                }
            }
        },
        onKeyDown,
    }
}

