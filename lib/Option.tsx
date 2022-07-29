import {Markup} from "./MarkedInput/types";

export interface OptionProps<T = Record<string, any>, T1 = Record<string, any>> {
    /**
     * Template string instead of which the mark is rendered.
     * Must contain placeholders: __value__ and __id__
     * @Example: @[__value__](__id__)
     */
    markup: Markup
    trigger?: string //| RegExp
    triggerInitializer?: (word: string) => T1
    /**
     * Function to initialize props for mark render. Gets arguments from found markup
     */
    initializer: (value: string, id: string) => T
}

/**
 * Used for configure a MarkedInput
 */
export const Option = <T, >(props: OptionProps<T>) => null