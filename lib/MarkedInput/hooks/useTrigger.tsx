import React, {useCallback, useRef, useState} from "react";
import {triggerToRegex} from "../utils";
import {OptionProps} from "../../Option";

//TODO reducer?
export const useTrigger = (configs: OptionProps<any>[]) => {
    const [word, setWord] = useState<string | undefined>()
    const configRef = useRef<OptionProps<any, any> | undefined>()
    const clear = useCallback(() => setWord(undefined), [])
    const check = useCallback(() => {
        for (let config of configs) {
            let word = findTriggeredWord(config.trigger)
            if (word) {
                configRef.current = config
                setWord(word)
                return
            }
        }
        setWord(undefined)
    }, [])

    return {word, check, clear, configRef}
}

function findTriggeredWord(trigger?: string): string | undefined {
    if (!trigger) return;

    const selection = window.getSelection()
    const position = selection?.anchorOffset
    const text = selection?.anchorNode?.textContent

    if (!position || !text) return

    const textBefore = text.slice(0, position)
    const textAfter = text.slice(position)

    const regexBefore = new RegExp(/ @\w*$/)
    const regexAfter = new RegExp(/^\w*/)

    const wordBefore = textBefore.match(regexBefore)?.[0] ?? ""
    const wordAfter = textAfter.match(regexAfter)?.[0] ?? ""

    const word = wordBefore + wordAfter

    const regex = triggerToRegex(trigger)

    if (regex.test(word)) return word
}
