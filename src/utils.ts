import {Children, ReactElement} from "react";
import {MarkupProps} from "./Markup";
import {PLACEHOLDER} from "./constants";
import {TagValue} from "./types";

export function getCaretIndex(element: HTMLElement) {
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
    // And set the range end to the original clicked position
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    // Return the text length from contenteditable start to the range end
    position = preCaretRange.toString().length;

    return position
}

export function setCaretToEnd(element: HTMLElement) {
    const selection = window.getSelection();
    selection?.setPosition(element, 1)
}

export function setCaretTo(element: HTMLElement, offset: number) {
    const selection = window.getSelection();
    const range = selection?.getRangeAt(0);
    range?.setStart(range.startContainer, offset)
    range?.setEnd(range.startContainer, offset)
}

export function setCaretRightTo(element: HTMLElement, offset: number) {
    const selection = window.getSelection();
    const range = selection?.getRangeAt(0);
    range?.setStart(range.endContainer, offset)
    range?.setEnd(range.endContainer, offset)
}

type id = `${string}${PLACEHOLDER.Id}${string}`
type value = `${string}${PLACEHOLDER.Value}${string}`
export type Mark = `${value}${id}` | `${id}${value}` | `${id}`

export const markupToRegex = (markup: string) => {
    const escapedMarkup = escapeRegex(markup)
    const charAfterDisplay = markup[markup.indexOf(PLACEHOLDER.Value) + PLACEHOLDER.Value.length]
    const charAfterId = markup[markup.indexOf(PLACEHOLDER.Id) + PLACEHOLDER.Id.length]
    return new RegExp(escapedMarkup
        .replace(PLACEHOLDER.Value, `([^${escapeRegex(charAfterDisplay || '')}]+?)`)
        .replace(PLACEHOLDER.Id, `([^${escapeRegex(charAfterId || '')}]+?)`),
    )
}

export const makeMentionsMarkup = (markup: string, id: string, value: string) => {
    return markup
        .replace(PLACEHOLDER.Id, id)
        .replace(PLACEHOLDER.Value, value)
}

// escape RegExp special characters https://stackoverflow.com/a/9310752/5142490
export const escapeRegex = (str: string) => str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')

export function toString(values: (string | TagValue<any>)[], children: ReactElement<MarkupProps<any>> | ReactElement<MarkupProps<any>>[]) {
    let result = ""
    let configs = Children.map(children, child => child)
    for (let value of values) {
        if (typeof value === "string")
            result += value
        else {
            result += makeMentionsMarkup(configs[value.childIndex].props.value, value.id, value.value)
        }
    }
    return result
}

//https://stackoverflow.com/a/52171480 cyrb53 generate hash
export const genHash = (str: string, seed = 0) => {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1>>>16), 2246822507) ^ Math.imul(h2 ^ (h2>>>13), 3266489909);
    h2 = Math.imul(h2 ^ (h2>>>16), 2246822507) ^ Math.imul(h1 ^ (h1>>>13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1>>>0);
}

export const genId = () => Math.random().toString(36).substring(2, 9)

