import {MarkProps, Markup, OverlayProps} from "./MarkedInput/types";

export interface OptionProps<T = Record<string, any>, T1 = OverlayProps> {
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
     * Function to initialize overlay props to your requirements.
     * If missing then passed overlay props directly.
     */
    //TODO Add the ref: RefObject<HTMLElement> such as second argument
    initOverlay?: (props: OverlayProps) => T1
    /**
     * Function to initialize props for the mark component. Gets arguments from found markup
     */
    initMark: (props: MarkProps) => T
}

/**
 * Used for configure a MarkedInput
 */
export const Option = <T, T1 = OverlayProps>({trigger = "@", markup = "@[__label__](__value__)", data = [], ...props}: OptionProps<T, T1>) => null