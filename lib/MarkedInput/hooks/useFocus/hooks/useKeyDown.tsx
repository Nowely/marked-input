import {KeyboardEvent, MutableRefObject, RefObject, useEffect} from "react";
import {Caret} from "../../../utils/Caret";
import {KEY} from "../../../constants";
import {Type} from "../../../types";
import {genHash, useStore} from "../../../utils";
import {Recovery} from "./useRecoveryAfterRemove";

export function useKeyDown(
    registered: Map<number, RefObject<HTMLSpanElement>>,
    keyRestoredElement: MutableRefObject<Recovery | null>,
    focusedElement: MutableRefObject<HTMLElement | null>
) {
    const {pieces, bus} = useStore()

    useEffect(() => bus.listen("onKeyDown", (event: KeyboardEvent<HTMLSpanElement>) => {
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
                const element = getPreviousElement()
                element?.focus()
                Caret.setCaretToEnd(element)
                event.preventDefault()
            }

            function handlePressRight() {
                const element = getNextElement()
                element?.focus()
                event.preventDefault()
            }

            function handlePressBackspace() {
                const key = getPreviousMarkKey()
                if (!key) return

                recoverLeft()
                bus.send(Type.Delete, {key})
                event.preventDefault()
            }

            function handlePressDelete() {
                const key = getNextMarkKey()
                if (!key) return

                recoverRight()
                bus.send(Type.Delete, {key})
                event.preventDefault()
            }
        }
    ), [])

    function recoverLeft() {
        let previousText = getPreviousElement()?.textContent!
        let currentText = focusedElement.current?.textContent!
        let newText = previousText + currentText

        keyRestoredElement.current = {
            key: genHash(newText),
            caret: previousText.length
        }
    }

    function recoverRight() {
        let nextText = getNextElement()?.textContent!
        let currentText = focusedElement.current?.textContent!
        let newText = currentText + nextText

        keyRestoredElement.current = {
            key: genHash(newText),
            caret: currentText.length
        }
    }

    function getPreviousElement() {
        let previous: HTMLElement | null = null

        if (!focusedElement.current)
            return null

        for (const [key, elementRef] of registered) {
            if (elementRef.current === focusedElement.current)
                return previous

            previous = elementRef.current
        }

        return previous
    }

    function getNextElement() {
        let isNext = false

        if (!focusedElement.current)
            return null

        for (const [key, elementRef] of registered) {
            if (isNext)
                return elementRef.current

            if (elementRef.current === focusedElement.current)
                isNext = true
        }

        return null
    }

    function getCurrentKey() {
        for (const [key, elementRef] of registered) {
            if (elementRef.current === focusedElement.current)
                return key
        }
    }

    function getPreviousMarkKey() {
        const current = getCurrentKey()
        let previous: number | null = null

        if (!focusedElement.current)
            return null

        for (const [key] of pieces) {
            if (key === current)
                return previous

            previous = key
        }

        return previous
    }

    function getNextMarkKey() {
        const current = getCurrentKey()
        let isNext = false

        if (!focusedElement.current)
            return null

        for (const [key] of pieces) {
            if (isNext)
                return key

            if (key === current)
                isNext = true
        }

        return null
    }
}