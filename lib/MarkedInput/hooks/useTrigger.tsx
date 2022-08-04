import React, {useCallback, useRef, useState} from "react";
import {assign, triggerToRegex} from "../utils";
import {OptionProps} from "../../Option";

export type Trigger = {
    word: string | undefined,
    triggeredValue: string | undefined,
    text: string | undefined,
    indexBefore: number | undefined,
    check: () => void,
    clear: () => void,
    config: OptionProps<any, any>,
    style: {
        left: number,
        top: number
    }
}

//TODO reducer?
export const useTrigger = (configs: OptionProps<any>[]): Trigger => {
    const [trigger, setTrigger] = useState<Omit<Trigger, "check" | "clear"> | undefined>()

    const clear = useCallback(() => setTrigger(undefined), [])
    const check = useCallback(() => {
        for (let config of configs) {
            let {word, triggeredValue, text, indexBefore} = findTriggeredWord(config.trigger) ?? {}
            if (word !== undefined) {
                setTrigger({
                    word,
                    triggeredValue,
                    style: getCaretAbsolutePosition(),
                    config,
                    text,
                    indexBefore
                })
                return
            }
        }
        setTrigger(undefined)
    }, [])

    return assign({}, trigger, {check, clear})
}

function findTriggeredWord(trigger?: string) {
    if (!trigger) return;

    const selection = window.getSelection()
    const position = selection?.anchorOffset
    const text = selection?.anchorNode?.textContent

    if (!position || !text) return

    const textBefore = text.slice(0, position)
    const textAfter = text.slice(position)

    const regexBefore = new RegExp(/@\w*$/)
    const regexAfter = new RegExp(/^\w*/)

    const matchBefore = textBefore.match(regexBefore)
    const indexBefore = matchBefore?.index
    const wordBefore = matchBefore?.[0] ?? ""
    const wordAfter = textAfter.match(regexAfter)?.[0] ?? ""

    const annotation = wordBefore + wordAfter

    const regex = triggerToRegex(trigger)

    const a = regex.exec(annotation)
    const triggeredValue = a?.[0]
    const word = a?.[1]
    if (word !== undefined) return {word, triggeredValue, text, indexBefore}
}

function getCaretAbsolutePosition() {
    const rect = window.getSelection()?.getRangeAt(0).getBoundingClientRect()
    if (rect) return {left: rect.left, top: rect.top + 20}
    return {left: 0, top: 0}
}