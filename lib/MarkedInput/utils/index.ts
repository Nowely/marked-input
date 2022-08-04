import React, {Children, Context, Provider, useContext} from "react";
import {PLACEHOLDER} from "../constants";
import {Mark, Markup, PassedOptions, Store} from "../types";
import {Parser} from "./Parser";
import {OptionProps} from "../../Option";

export const assign = Object.assign

export const markupToRegex = (markup: Markup) => {
    const escapedMarkup = escapeRegex(markup)
    const charAfterValue = markup[markup.indexOf(PLACEHOLDER.Value) + PLACEHOLDER.Value.length]
    const charAfterId = markup[markup.indexOf(PLACEHOLDER.Id) + PLACEHOLDER.Id.length]
    return new RegExp(escapedMarkup
        .replace(PLACEHOLDER.Value, `([^${escapeRegex(charAfterValue || '')}]+?)`)
        .replace(PLACEHOLDER.Id, `([^${escapeRegex(charAfterId || '')}]+?)`),
    )
}

export const triggerToRegex = (value: string) => {
    const escapedValue = escapeRegex(value)
    const pattern = escapedValue + "(\\w*)"
    return new RegExp(pattern)
}

/**
 * Make annotation from the markup
 */
export function annotate(markup: Markup, value: string, id?: string) {
    let annotation = markup.replace(PLACEHOLDER.Value, value)
    return id ? annotation.replace(PLACEHOLDER.Id, id) : annotation
}

/**
 * Transform the annotated text to the another text
 */
export function denote(value: string, callback: (mark: Mark) => string, ...markups: Markup[]) {
    const slices = new Parser(markups).split(value)
    return slices.reduce((previous: string, current) => previous += isObject(current) ? callback(current) : current, "");
}

// escape RegExp special characters https://stackoverflow.com/a/9310752/5142490
export const escapeRegex = (str: string) => str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')

export function toString(values: (string | Mark)[], options: OptionProps[]) {
    let result = ""
    for (let value of values) {
        result += isObject(value)
            ? annotate(options[value.childIndex].markup, value.value, value.id)
            : value
    }
    return result
}

export const normalizeMark = (mark: Mark, markup: Markup) => {
    if (mark.annotation !== annotate(markup, mark.value, mark.id))
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

export function extractOptions(children: PassedOptions<any>): OptionProps[] {
    return Children.map(children, child => child.props);
}

const createContext = <T, >(name: string): [() => T, Provider<NonNullable<T>>] => {
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
