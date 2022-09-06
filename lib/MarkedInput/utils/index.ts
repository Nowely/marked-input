import React, {Children, Context, isValidElement, Provider, useContext} from "react";
import {DefaultOptionProps, PLACEHOLDER} from "../constants";
import {ElementOptions, EventName, Mark, Markup, Options, Store} from "../types";
import {Parser} from "./Parser";
import {OptionProps} from "../../Option";

export const assign = Object.assign

//TODO the alternative way to create markup?
//const markup2: any = createMarkup("@[__label__]", "(__value__)")
//const markup3: any = createMarkup("@[hello](world)", "hello", "world")

export const markupToRegex = (markup: Markup) => {
    const escapedMarkup = escapeRegex(markup)
    const charAfterLabel = markup[markup.indexOf(PLACEHOLDER.LABEL) + PLACEHOLDER.LABEL.length]
    const charAfterValue = markup[markup.indexOf(PLACEHOLDER.VALUE) + PLACEHOLDER.VALUE.length]
    return new RegExp(escapedMarkup
        .replace(PLACEHOLDER.LABEL, `([^${escapeRegex(charAfterLabel || '')}]+?)`)
        .replace(PLACEHOLDER.VALUE, `([^${escapeRegex(charAfterValue || '')}]+?)`)
    )
}

//TODO move in here trigger regex manipulating
export const triggerToRegex = (value: string) => {
    const escapedValue = escapeRegex(value)
    const pattern = escapedValue + "(\\w*)"
    return new RegExp(pattern)
}

//TODO annotate options to object with required only label?
/**
 * Make annotation from the markup
 */
export function annotate(markup: Markup, label: string, value?: string): string {
    let annotation = markup.replace(PLACEHOLDER.LABEL, label)
    return value ? annotation.replace(PLACEHOLDER.VALUE, value) : annotation
}

/**
 * Transform the annotated text to the another text
 */
export function denote(value: string, callback: (mark: Mark) => string, ...markups: Markup[]): string {
    if (!markups.length) return value
    const pieces = new Parser(markups).split(value)
    return pieces.reduce((previous: string, current) => previous += isObject(current) ? callback(current) : current, "");
}

// escape RegExp special characters https://stackoverflow.com/a/9310752/5142490
export const escapeRegex = (str: string) => str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')

export function toString(values: (string | Mark)[], options: Options) {
    let result = ""
    for (let value of values) {
        result += isObject(value)
            ? annotate(options[value.childIndex].markup, value.label, value.value)
            : value
    }
    return result
}

export const normalizeMark = (mark: Mark, markup: Markup) => {
    if (mark.annotation !== annotate(markup, mark.label, mark.value))
        return {...mark, label: mark.value, value: mark.label}
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

export const isFunction = (value: unknown): value is Function => typeof value === "function"

export const isEventName = (value: string): value is EventName => value.startsWith("on")

const isElementOption = (value?: ElementOptions<any> | OptionProps[]): value is ElementOptions<any> => {
    if (isValidElement(value)) return true
    return isValidElement(value?.[0]);
}

export function extractOptions(options?: ElementOptions<any> | OptionProps[]): Options {
    if (isElementOption(options))
        return Children.map(options, child => initOption(child.props))

    if (options?.length)
        return options.map(initOption)

    return [DefaultOptionProps]

    function initOption(props: OptionProps) {
        return assign({}, DefaultOptionProps, props)
    }
}

const createContext = <T, >(name: string): [() => T, Provider<NonNullable<T>>] => {
    const context = React.createContext<T | undefined>(undefined)
    context.displayName = name

    const hook = createContextHook(context)
    const provider = context.Provider as Provider<NonNullable<T>>

    return [hook, provider]


    function createContextHook<T, >(context: Context<T>) {
        return () => {
            const value = useContext(context)

            if (value) return value as NonNullable<T>

            throw new Error(`The context ${context.displayName} didn't found!`)
        }
    }
}

export const [useStore, StoreProvider] = createContext<Store>("MarkedInputStoreProvider")
