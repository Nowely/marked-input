import {Mark} from "./utils";

export interface MarkupProps<T = Record<string, any>> {
    value: Mark
    trigger?: string //| RegExp
    valueKey: string & keyof T
    bindTo?: string
    inner: T
}

export const Markup = <T,>(props: MarkupProps<T>) => null