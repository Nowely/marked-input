import {useState} from "react";

export const useCaret = () => useState(() => new Caret())[0]

/**
 * Restore caret on union for two spans
 */
export class Caret {
    constructor(
        private _position: number = NaN,
    ) {
    }

    get isBlurred() {
        return Number.isNaN(this._position)
    }

    clear() {
        this._position = NaN
    }

    static setIndex(offset: number) {
        const selection = window.getSelection()
        if (!selection?.anchorNode || !selection.rangeCount) return

        const range = selection.getRangeAt(0)
        range?.setStart(range.startContainer.firstChild || range.startContainer, offset)
        range?.setEnd(range.startContainer.firstChild || range.startContainer, offset)
    }

    static getIndex() {
        const selection = window.getSelection()
        return selection?.anchorOffset ?? NaN
    }

    saveRightOffset() {
        const selection = window.getSelection()
        const position = selection?.anchorNode?.textContent?.length
        this._position = position ?? NaN
    }

    restoreRightOffset() {
        if (this.isBlurred) return

        const selection = window.getSelection()
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null
        if (!selection?.anchorNode) return
        let offset = (selection?.anchorNode?.textContent?.length ?? 0) - this._position
        range?.setStart(selection.anchorNode, offset)
        range?.setEnd(selection.anchorNode, offset)
        this.clear()
    }

    static getCaretIndex(element: HTMLElement) {
        let position = 0;

        const selection = window.getSelection();
        // Check if there is a selection (i.e. cursor in place)
        if (!selection?.rangeCount) return position;

        // Store the original range
        const range = selection.getRangeAt(0);
        //selection.setPosition(element, 1)
        // Clone the range
        const preCaretRange = range.cloneRange();
        // Select all textual contents from the contenteditable element
        preCaretRange.selectNodeContents(element);
        // And set the range end to the original clicked _position
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        // Return the text length from contenteditable start to the range end
        position = preCaretRange.toString().length;

        return position
    }

    static setCaretToEnd(element: HTMLElement) {
        const selection = window.getSelection();
        selection?.setPosition(element, 1)
    }

    setCaretRightTo(element: HTMLElement, offset: number) {
        const selection = window.getSelection();
        const range = selection?.getRangeAt(0);
        range?.setStart(range.endContainer, offset)
        range?.setEnd(range.endContainer, offset)
    }
}
