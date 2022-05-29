import React, {Children, Context, Provider, useContext} from "react";
import {PLACEHOLDER} from "../constants";
import {Configs, Mark, Markup, PassedOptions, Store} from "../types";

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

export const makeAnnotation = (markup: string, id: string, value: string) => {
    return markup
        .replace(PLACEHOLDER.Id, id)
        .replace(PLACEHOLDER.Value, value)
}

// escape RegExp special characters https://stackoverflow.com/a/9310752/5142490
export const escapeRegex = (str: string) => str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')

export function toString(values: (string | Mark)[], configs: Configs<any>) {
    let result = ""
    for (let value of values) {
        result += isObject(value)
            ? makeAnnotation(configs[value.childIndex].markup, value.id, value.value)
            : value
    }
    return result
}

export const normalizeMark = (mark: Mark, markup: Markup) => {
    if (mark.annotation !== makeAnnotation(markup, mark.id, mark.value))
        return {...mark, id: mark.value, value: mark.id}
    return mark
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

export const isObject = (value: unknown): value is object => typeof value === "object"

//TODO deannotate method
/**
 * Transform annotated text to display text
 */
export const deannotate = () => {

}

export const deMark = () => {

}

export function extractConfigs(children: PassedOptions<any>): Configs<any> {
    return Children.map(children, child => child.props);
}

const createContext = <T,>(name: string): [() => T, Provider<NonNullable<T>>] => {
    const context = React.createContext<T | undefined>(undefined)
    context.displayName = name

    const hook = createContextHook(context)
    const provider = createProvider(context)

    return [hook, provider]


    function createContextHook<T, >(context: Context<T>) {
        return () => {
            const value = useContext(context)

            if (value) return value as NonNullable<T>

            throw new Error(`The context ${context.displayName} didn't found!`)
        }
    }

    function createProvider<T, >(context: Context<T>) {
        let value = context as unknown as Context<NonNullable<T>>
        return value.Provider
    }
}

export const [useStore, StoreProvider] = createContext<Store>("MarkedInputStoreProvider")
