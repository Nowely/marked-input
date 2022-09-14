import {MutableRefObject, RefObject} from "react";
import {Recovery} from "../components/MarkedText/hooks/useFocus/hooks/useRecoveryAfterRemove";
import {KeyedPieces} from "../types";
import {genHash} from "./index";

export class Oracle {
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