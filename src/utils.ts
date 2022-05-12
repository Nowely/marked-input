import {Children, ReactElement} from "react";
import {OptionProps} from "./Option";
import {PLACEHOLDER} from "./constants";
import {Mark} from "./types";

export const assign = Object.assign

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

export function toString(values: (string | Mark<any>)[], children: ReactElement<OptionProps<any>> | ReactElement<OptionProps<any>>[]) {
    let result = ""
    let configs = Children.map(children, child => child)
    for (let value of values) {
        result += isMark(value)
            ? makeMentionsMarkup(configs[value.childIndex].props.markup, value.id, value.value)
            : value
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
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export const genId = () => Math.random().toString(36).substring(2, 9)

export const isMark = (value: unknown): value is Mark<unknown> => typeof value === "object"

//TODO deannotate method
/**
 * Transform annotated text to display text
 */
export const deannotate = () => {

}
