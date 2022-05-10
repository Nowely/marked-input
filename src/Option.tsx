import {Markup} from "./utils";

export interface OptionProps<T = Record<string, any>> {
    markup: Markup
    trigger?: string //| RegExp
    valueKey: string & keyof T
    bindTo?: string
    inner: T
}

export const Option = <T,>(props: OptionProps<T>) => null