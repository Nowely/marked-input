import React, {FocusEvent, useCallback, useEffect, useState} from "react";
import {assign, escapeRegex, triggerToRegex, useStore} from "../../utils";
import {Options, OptionType} from "../../types";
import {EventBus} from "../../utils/EventBus";

export type Trigger = {
    word: string,
    triggeredValue: string | undefined,
    text: string | undefined,
    indexBefore: number | undefined,
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
        for (let option of options) {
            let found = findTriggeredWord(option.trigger)
            if (found)
                return assign(found, {option, style: getCaretAbsolutePosition()})
        }
        return null
    }

    constructor(
        readonly options: Options
    ) {

    }
}

function findTriggeredWord(trigger?: string) {
    if (!trigger) return;

    const selection = window.getSelection()
    const position = selection?.anchorOffset
    const text = selection?.anchorNode?.textContent

    if (!position || !text) return

    const textBefore = text.slice(0, position)
    const textAfter = text.slice(position)

    const escapedTrigger = escapeRegex(trigger)
    const pattenRegexBefore = '\\s?' + escapedTrigger + '\\w*$'
    const regexBefore = new RegExp(pattenRegexBefore)
    const regexAfter = new RegExp(/^\w*/)

    const matchBefore = textBefore.match(regexBefore)
    if (!matchBefore) return
    const wordBefore = matchBefore[0] ?? ""
    const indexBefore = matchBefore.index! + (isSpaceFirst(wordBefore) ? 1 : 0)
    const wordAfter = textAfter.match(regexAfter)?.[0] ?? ""

    const annotation = wordBefore + wordAfter

    const regex = triggerToRegex(trigger)

    const a = regex.exec(annotation)
    const triggeredValue = a?.[0]
    const word = a?.[1]
    if (word !== undefined) return {word, triggeredValue, text, indexBefore, style: getCaretAbsolutePosition()}
}

function isSpaceFirst(value: string) {
    return value.startsWith(" ")
}

function getCaretAbsolutePosition() {
    const rect = window.getSelection()?.getRangeAt(0).getBoundingClientRect()
    if (rect) return {left: rect.left, top: rect.top + 20}
    return {left: 0, top: 0}
}