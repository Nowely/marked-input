import {Markup} from "../types";

export interface OptionProps<T = Record<string, any>> {
    /**
     * Template string instead of which the mark is rendered.
     * Must contain placeholders: __value__ and __id__
     * @Example: @[__value__](__id__)
     */
    markup: Markup
    //TODO trigger?: string //| RegExp
    /**
     * Function to initialize props for mark render. Gets arguments from found markup
     */
    initializer: (value: string, id: string) => T
}

/**
 * Used for configure a MarkedInput
 */
export const Option = <T, >(props: OptionProps<T>) => null