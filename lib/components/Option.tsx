import {MarkProps, Markup} from "../types";

export interface OptionProps<T = Record<string, any>> {
    /**
     * Template string instead of which the mark is rendered.
     * Must contain placeholders: `__label__` and optional `__value__`
     * @Default "@[__label__](__value__)"
     */
    markup?: Markup
    /**
     * Sequence of symbols for calling the overlay.
     * @Default "@"
     */
    trigger?: string //| RegExp
    /**
     * Data for an overlay component. By default, it is suggestions.
     */
    data?: string[] //TODO | object[]
    /**
     * Function to initialize props for the mark component. Gets arguments from found markup
     */
    initMark?: (props: MarkProps) => T
}

/**
 * Used for configure a MarkedInput
 */
export const Option = <T,>({trigger = "@", markup = "@[__label__](__value__)", data = [], ...props}: OptionProps<T>) => null