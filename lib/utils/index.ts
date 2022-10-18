import React, {Children, Context, isValidElement, Provider, useContext} from "react";
import {DefaultOptionProps, PLACEHOLDER} from "../constants";
import {
    ElementOptions,
    EventName,
    KeyedPieces,
    AnnotatedMark,
    Markup,
    Options,
    Piece,
    NodeData,
    Store,
    Mark
} from "../types";
import {Parser} from "./Parser";
import {OptionProps} from "../components/Option";
import LinkedList from "./LinkedList";

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

//TODO annotate options to object with required only label?
//TODO function annotate(label: string, markup?: Markup, value?: string): string;
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
export function denote(value: string, callback: (mark: AnnotatedMark) => string, ...markups: Markup[]): string {
    if (!markups.length) return value
    const pieces = new Parser(markups).split(value)
    return pieces.reduce((previous: string, current) => previous += isObject(current) ? callback(current) : current, "");
}

// escape RegExp special characters https://stackoverflow.com/a/9310752/5142490
export const escapeRegex = (str: string) => str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')

export function toString(values: Mark[], options: Options) {
    let result = ""
    for (let value of values) {
        result += isAnnotated(value)
            ? annotate(options[value.childIndex].markup, value.label, value.value)
            : value.label
    }
    return result
}

export const normalizeMark = (mark: AnnotatedMark, markup: Markup) => {
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

export const isAnnotated = (value: unknown): value is AnnotatedMark => {
    return value !== null && typeof value === 'object' && 'annotation' in value
}

export function assertAnnotated(value: unknown): asserts value is AnnotatedMark {
    let condition = value !== null && typeof value === 'object' && 'annotation' in value
    if (!condition) throw new Error("Value is not annotated mark!")
}

export const isFunction = (value: unknown): value is Function => typeof value === "function"

export const isEventName = (value: string | number): value is EventName => typeof value === "string" && value.startsWith("on")

const isElementOption = (value?: ElementOptions<any> | OptionProps[]): value is ElementOptions<any> => {
    if (isValidElement(value)) return true
    return isValidElement(value?.[0]);
}

export function extractOptions(options?: ElementOptions<any> | OptionProps[]): Options {
    if (isElementOption(options))
        return Children.map(options, (child, index) => initOption(child.props, index))

    if (options?.length) return options.map(initOption)

    return [DefaultOptionProps]

    function initOption(props: OptionProps, index: number) {
        return assign({}, DefaultOptionProps, props, {index})
    }
}

const createContext = <T, >(name: string): [() => T, React.Context<NonNullable<T>>] => {
    const defaultContext = React.createContext<T | undefined>(undefined)
    defaultContext.displayName = name

    const hook = createContextHook(defaultContext)
    //const provider = defaultContext.Provider as Provider<NonNullable<T>>
    const context = defaultContext as  React.Context<NonNullable<T>>

    return [hook, context]


    function createContextHook<T, >(context: Context<T>) {
        return () => {
            const value = useContext(context)

            if (value) return value as NonNullable<T>

            throw new Error(`The context ${context.displayName} didn't found!`)
        }
    }
}

export const [useStore, StoreContext] = createContext<Store>("MarkedInputStoreProvider")
export const [useValue, ValueContext] = createContext<LinkedList<NodeData>>("ValueProvider")
export const [useNode, NodeContext] = createContext<NodeData>("NodeProvider")

//TODO fix passing arguments
export function debounce(func: Function, wait: number, immediate: boolean = true) {
    let timeout: NodeJS.Timeout | undefined
    return () => {
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow)
            func.apply(arguments);
    }

    function later() {
        timeout = undefined;
        if (!immediate)
            func(arguments);
    }
}

export function findSpanKey(span: string, pieces: KeyedPieces) {
    let foundKey
    for (let [key, piece] of pieces) {
        if (piece === span) {
            foundKey = key
            break
        }
    }
    return foundKey
}

export function createNewSpan(span: string, annotation: string, index: number, source: string) {
    return span.slice(0, index) + annotation + span.slice(index + source.length)
}

export function genKey(piece: Piece, cache?: Set<number>) {
    const str = isObject(piece) ? piece.label + piece.value : piece

    let seed = 0, key = genHash(str, seed)
    while (cache?.has(key))
        key = genHash(str, seed++)
    cache?.add(key)
    return key;
}