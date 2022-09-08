import {Options, Trigger} from "../types";
import {escapeRegex} from "./index";
import {wordRegex} from "../constants";

export class TriggerFinder {
    text: string;
    dividedText: { left: string; right: string }

    static find(options: Options) {
        if (this.isContinue)
            return new TriggerFinder().find(options)
    }

    static get isContinue() {
        const selection = window.getSelection()
        if (!selection) return false

        return selection.anchorOffset === selection.focusOffset
    }

    constructor() {
        let caretPosition = this.getCaretPosition()
        this.text = this.getCurrentPieceOfText()
        this.dividedText = this.getDividedTextBy(caretPosition)
    }

    getCaretPosition() {
        return window.getSelection()?.anchorOffset ?? 0
    }

    getCurrentPieceOfText() {
        return window.getSelection()?.anchorNode?.textContent ?? ""
    }

    getDividedTextBy(position: number) {
        return {left: this.text.slice(0, position), right: this.text.slice(position)}
    }

    find(options: Options): Trigger | undefined {
        for (let option of options) {
            let match = this.matchInTextVia(option.trigger)
            if (match) return {
                value: match.word,
                source: match.annotation,
                index: match.index,
                piece: this.text,
                style: this.getCaretAbsolutePosition(),
                option
            }
        }
    }

    matchInTextVia(trigger: string) {
        const rightMatch = this.matchRightPart()
        const leftMatch = this.matchLeftPart(trigger)
        if (leftMatch) return {
            word: leftMatch.word + rightMatch.word,
            annotation: leftMatch.annotation + rightMatch.word,
            index: leftMatch.index,
        }
    }

    matchLeftPart(trigger: string) {
        const regex = this.makeTriggerRegex(trigger)
        const {left} = this.dividedText
        const match = left.match(regex)

        if (!match) return

        const [annotation, word] = match
        return {word, annotation, index: match.index ?? 0}
    }

    //TODO new trigger option if (isSpaceBeforeRequired) append space check for not first words '\\s'
    makeTriggerRegex(trigger: string): RegExp {
        const patten = escapeRegex(trigger) + '(\\w*)$'
        return new RegExp(patten)
    }

    matchRightPart() {
        const {right} = this.dividedText
        return {word: right.match(wordRegex)?.[0]}
    }

    getCaretAbsolutePosition() {
        const rect = window.getSelection()?.getRangeAt(0).getBoundingClientRect()
        if (rect)
            return {left: rect.left, top: rect.top + 20}
        return {left: 0, top: 0}
    }
}