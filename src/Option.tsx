import {Markup} from "./utils";

//TODO initialArg, init?
export interface OptionProps<T = Record<string, any>> {
    markup: Markup
    trigger?: string //| RegExp
    valueKey: string & keyof T
    bindTo?: string
    inner: T
}

export const Option = <T,>(props: OptionProps<T>) => null