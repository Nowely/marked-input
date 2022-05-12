import {Markup} from "./types";

//TODO initialArg, init?  initialState initializer initializerArg
export interface OptionProps<T = Record<string, any>> {
    markup: Markup
    //TODO trigger?: string //| RegExp
    initializer: (value: string, id: string) => T
}

export const Option = <T,>(props: OptionProps<T>) => null