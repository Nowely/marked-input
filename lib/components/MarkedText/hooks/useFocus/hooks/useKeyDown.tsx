import {KeyboardEvent, MutableRefObject, RefObject, useEffect} from "react";
import {Caret} from "../../../../../utils/Caret";
import {KEY} from "../../../../../constants";
import {KeyedPieces, Type} from "../../../../../types";
import {genHash, useStore} from "../../../../../utils";
import {Recovery} from "./useRecoveryAfterRemove";

export function useKeyDown(
    spanRefs: Map<number, RefObject<HTMLElement>>,
    recoveryRef: MutableRefObject<Recovery | null>,
    focusedSpanRef: MutableRefObject<HTMLElement | null>
) {
    const {pieces, bus} = useStore()

    useEffect(() => bus.listen("onKeyDown", (event: KeyboardEvent<HTMLSpanElement>) => {
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
        }
    ), [pieces])
}

class Oracle {
    constructor(
        readonly focusedSpanRef: MutableRefObject<HTMLElement | null>,
        readonly spanRefs: Map<number, RefObject<HTMLSpanElement>>,
        readonly recoveryRef: MutableRefObject<Recovery | null>,
        readonly pieces: KeyedPieces
    ) {
    }

    recoverLeft() {
        let previousText = this.getPreviousElement()?.textContent!
        let currentText = this.focusedSpanRef.current?.textContent!
        let newText = previousText + currentText

        this.recoveryRef.current = {
            key: genHash(newText),
            caret: previousText.length
        }
    }

    recoverRight() {
        let nextText = this.getNextElement()?.textContent!
        let currentText = this.focusedSpanRef.current?.textContent!
        let newText = currentText + nextText

        this.recoveryRef.current = {
            key: genHash(newText),
            caret: currentText.length
        }
    }

    getPreviousElement() {
        let previous: HTMLElement | null = null

        if (!this.focusedSpanRef.current)
            return null

        for (const [key, elementRef] of this.spanRefs) {
            if (elementRef.current === this.focusedSpanRef.current)
                return previous

            previous = elementRef.current
        }

        return null
    }

    getNextElement() {
        let isNext = false

        if (!this.focusedSpanRef.current)
            return null

        for (const [key, elementRef] of this.spanRefs) {
            if (isNext)
                return elementRef.current

            if (elementRef.current === this.focusedSpanRef.current)
                isNext = true
        }

        return null
    }

    getPreviousMarkKey() {
        let previous: number | null = null
        const current = this.getCurrentKey()

        if (!current) return null

        for (const [key] of this.pieces) {
            if (key === current)
                return previous

            previous = key
        }

        return null
    }

    getNextMarkKey() {
        let isNext = false
        const current = this.getCurrentKey()

        if (!current) return null

        for (const [key] of this.pieces) {
            if (isNext)
                return key

            if (key === current)
                isNext = true
        }

        return null
    }

    getCurrentKey() {
        if (!this.focusedSpanRef.current) return null

        for (const [key, elementRef] of this.spanRefs) {
            if (elementRef.current === this.focusedSpanRef.current)
                return key
        }

        return null
    }
}