import React, {FocusEvent, useCallback, useEffect, useState} from "react";
import {assign, escapeRegex, triggerToRegex, useStore} from "../../utils";
import {Options, OptionType} from "../../types";
import {EventBus} from "../../utils/EventBus";

export type Trigger = {
    word: string,
    triggeredValue: string | undefined,
    text: string | undefined,
    index: number | undefined,
    option: OptionType,
    style: {
        left: number,
        top: number
    }
}

//TODO reducer?
export const useTrigger = (): Trigger | null => {
    const {options, bus} = useStore()
    const [trigger, setTrigger] = useState<Trigger | null>(null)

    const check = useCallback(() => setTrigger(TriggerFinder.find(options)), [options])

    useEffect(() => bus.listen("onFocus", (e: FocusEvent<HTMLElement>) => {
        document.addEventListener("selectionchange", check)
    }), [])

    useEffect(() => bus.listen("onBlur", (e: FocusEvent<HTMLElement>) => {
        document.removeEventListener("selectionchange", check);
        //TODO. It is for overlay click correct handling
        setTimeout(_ => setTrigger(null), 200)
    }), [])

    return trigger
}

class TriggerFinder {
    static find(options: Options) {
        return new TriggerFinder().find(options)
    }

    find(options: Options): Trigger | null {
        for (let option of options) {
            let found = this.queryWordBy(option.trigger)
            if (found)
                return assign(found, {option})
        }
        return null
    }

    //Current TODO:
    //Trigger to regex twice
    //Naming
    queryWordBy(trigger: string) {
        const caretPosition = this.queryCaretPosition()
        const text = this.querySpanText()

        if (!caretPosition || !text) return

        const [textBefore, textAfter] = this.divide(text, caretPosition)
        const [regexBefore, regexAfter] = this.makeRegex(trigger)
        const annDetails = this.queryAnnotationDetails(textBefore, textAfter, regexBefore, regexAfter)

        if (!annDetails) return

        const word = this.queryWord(trigger, annDetails.annotation)
        if (word !== undefined)
            return {
                word,
                triggeredValue: annDetails.annotation,
                text,
                index: annDetails.index,
                style: this.getCaretAbsolutePosition()
            }
    }

    queryCaretPosition() {
        const selection = window.getSelection()
        if (!selection) return

        const isSelectedPosition = selection.anchorOffset === selection.focusOffset
        if (!isSelectedPosition) return

        return selection.anchorOffset
    }

    querySpanText() {
        return window.getSelection()?.anchorNode?.textContent
    }

    divide(text: string, position: number): [string, string] {
        return [text.slice(0, position), text.slice(position)]
    }

    makeRegex(trigger: string): [RegExp, RegExp] {
        const escapedTrigger = escapeRegex(trigger)
        const pattenRegexBefore = '\\s?' + escapedTrigger + '\\w*$'
        const regexBefore = new RegExp(pattenRegexBefore)
        const regexAfter = new RegExp(/^\w*/)
        return [regexBefore, regexAfter]
    }

    queryAnnotationDetails(textBefore: string, textAfter: string, regexBefore: RegExp, regexAfter: RegExp) {
        const matchBefore = textBefore.match(regexBefore)
        if (!matchBefore) return
        const wordBefore = matchBefore[0] ?? ""
        const indexBefore = matchBefore.index! + (this.isSpaceFirst(wordBefore) ? 1 : 0)
        const wordAfter = textAfter.match(regexAfter)?.[0] ?? ""

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


