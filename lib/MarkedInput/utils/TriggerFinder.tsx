import {Options, Trigger} from "../types";
import {escapeRegex} from "./index";

export class TriggerFinder {
    sourceText: string;
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
        this.sourceText = this.getSourceText()
        this.dividedText = this.getDividedTextBy(caretPosition)
    }

    getCaretPosition() {
        return window.getSelection()?.anchorOffset ?? 0
    }

    getSourceText() {
        return window.getSelection()?.anchorNode?.textContent ?? ""
    }

    getDividedTextBy(position: number) {
        return {left: this.sourceText.slice(0, position), right: this.sourceText.slice(position)}
    }

    find(options: Options): Trigger | undefined {
        for (let option of options) {
            let found = this.queryAnnotationDetails(option.trigger)
            if (found)
                return {
                    value: found.word,
                    source: found.annotation,
                    index: found.index,
                    piece: this.sourceText,
                    style: this.getCaretAbsolutePosition(),
                    option
                }
        }
    }

    //TODO Clean up
    queryAnnotationDetails(trigger: string) {
        const [regexBefore, regexAfter] = this.makeRegex(trigger)

        const {left, right} = this.dividedText
        const matchBefore = left.match(regexBefore)
        if (!matchBefore) return
        const annotationBefore = matchBefore[0] ?? ""
        const wordBefore = matchBefore[1] ?? ""
        const index = matchBefore.index! + (this.isSpaceFirst(wordBefore) ? 1 : 0)
        const matchAfter = right.match(regexAfter)
        const wordAfter = matchAfter?.[0]

        const word = wordBefore + wordAfter
        const annotation = annotationBefore + wordAfter

        return {annotation, index, word}
    }

    makeRegex(trigger: string): [RegExp, RegExp] {
        const escapedTrigger = escapeRegex(trigger)
        const pattenRegexBefore = '\\s?' + escapedTrigger + '(\\w*)$'
        const regexBefore = new RegExp(pattenRegexBefore)
        const regexAfter = new RegExp(/^\w*/)
        return [regexBefore, regexAfter]
    }

    isSpaceFirst(value: string) {
        return value.startsWith(" ")
    }

    getCaretAbsolutePosition() {
        const rect = window.getSelection()?.getRangeAt(0).getBoundingClientRect()
        if (rect) return {left: rect.left, top: rect.top + 20}
        return {left: 0, top: 0}
    }
}