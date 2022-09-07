import {Options} from "../types";
import {assign, escapeRegex, triggerToRegex} from "./index";
import {Trigger} from "../components/OverlayTrigger/useTrigger";

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
        return { left: this.sourceText.slice(0, position), right: this.sourceText.slice(position)}
    }

    find(options: Options): Trigger | undefined {
        for (let option of options) {
            let found = this.queryWordBy(option.trigger)
            if (found)
                return assign(found, {option})
        }
    }

    //Current TODO:
    //Trigger to regex twice
    //Naming
    queryWordBy(trigger: string) {
        const [regexBefore, regexAfter] = this.makeRegex(trigger)
        const annDetails = this.queryAnnotationDetails(regexBefore, regexAfter)

        if (!annDetails) return

        const word = this.queryWord(trigger, annDetails.annotation)
        if (word !== undefined)
            return {
                word,
                triggeredValue: annDetails.annotation,
                text: this.sourceText,
                index: annDetails.index,
                style: this.getCaretAbsolutePosition()
            }
    }

    makeRegex(trigger: string): [RegExp, RegExp] {
        const escapedTrigger = escapeRegex(trigger)
        const pattenRegexBefore = '\\s?' + escapedTrigger + '\\w*$'
        const regexBefore = new RegExp(pattenRegexBefore)
        const regexAfter = new RegExp(/^\w*/)
        return [regexBefore, regexAfter]
    }

    queryAnnotationDetails(regexBefore: RegExp, regexAfter: RegExp) {
        const {left, right} = this.dividedText
        const matchBefore = left.match(regexBefore)
        if (!matchBefore) return
        const wordBefore = matchBefore[0] ?? ""
        const indexBefore = matchBefore.index! + (this.isSpaceFirst(wordBefore) ? 1 : 0)
        const wordAfter = right.match(regexAfter)?.[0] ?? ""

        const annotation = wordBefore + wordAfter

        return {annotation, index: indexBefore}
    }

    queryWord(trigger: string, annotation: string) {
        const triggerRegex = triggerToRegex(trigger)
        const exec = triggerRegex.exec(annotation)
        //const triggeredValue = exec?.[0]
        const word = exec?.[1]
        return word
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