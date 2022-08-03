import React, {useCallback, useRef, useState} from "react";
import {triggerToRegex} from "../utils";
import {OptionProps} from "../../Option";

//TODO reducer?
export const useTrigger = (configs: OptionProps<any>[]) => {
    const [word, setWord] = useState<string | undefined>()
    const configRef = useRef<OptionProps<any, any> | undefined>()
    const stylesRef = useRef<{ left: number, top: number }>({top: 0, left: 0})

    const clear = useCallback(() => setWord(undefined), [])
    const check = useCallback(() => {
        for (let config of configs) {
            let word = findTriggeredWord(config.trigger)
            if (word !== undefined) {
                configRef.current = config
                stylesRef.current = getCaretAbsolutePosition()
                setWord(word)
                return
            }
        }
        setWord(undefined)
    }, [])

    return {word, check, clear, configRef, stylesRef}
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

    const annotation = wordBefore + wordAfter

    const regex = triggerToRegex(trigger)

    const word = regex.exec(annotation)?.[1]
    if (word !== undefined) return word
}

function getCaretAbsolutePosition() {
    const rect = window.getSelection()?.getRangeAt(0).getBoundingClientRect()
    if (rect) return {left: rect.left, top: rect.top + 15}
    return {left: 0, top: 0}
}