import {Markup, OverlayProps} from "./MarkedInput/types";

export interface Option<T = Record<string, any>, T1 = Record<string, any>> {
    /**
     * Template string instead of which the mark is rendered.
     * Must contain placeholders: __value__ and __id__
     * @Example: @[__value__](__id__)
     */
    markup: Markup
    /**
     * Sequence of symbols for calling the overlay.
     */
    trigger?: string //| RegExp
    /**
     * Data for a overlay component. By default, it is suggestions.
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
    initializer: (value: string, id: string) => T //TODO rename to initMark
}

/**
 * Used for configure a MarkedInput
 */
export const Option = <T, >(props: Option<T>) => null