import {ComponentType, CSSProperties} from "react";
import {OverlayProps, ElementOptions, MarkProps} from "./types";
import {MarkedText} from "./components/MarkedText";
import {OverlayTrigger} from "./components/OverlayTrigger";
import {OptionProps} from "../Option";
import {MarkedInputProvider} from "./components/MarkedInputProvider";
import "./style.css"

export interface MarkedInputProps<T = MarkProps, T1 = OverlayProps> {
    /**
     * Annotated text with markups for mark
     */
    value: string
    /**
     * Change event
     */
    onChange: (value: string) => void
    /**
     * Component that used for render markups
     */
    Mark: ComponentType<T>
    /**
     * Component that used for render overlays such as suggestions, mentions, autocomplete, modal, tooltip and etc.
     */
    Overlay?: ComponentType<T1>
    /**
     * Prevents from changing the value
     */
    readOnly?: boolean
    /**
     * Passed options for configure
     * @Default One option with default values is used
     */
    children?: ElementOptions<T> | OptionProps[]
    /**
     * Additional classes
     */
    className?: string
    /**
     * Additional style
     */
    style?: CSSProperties
    /**
     * Additional classes for span
     */
    spanClassName?: string
    /**
     * Additional style for span
     */
    spanStyle?: CSSProperties
}

export function MarkedInput<T = MarkProps, T1 = OverlayProps>(props: MarkedInputProps<T, T1>) {
    return <MarkedInputProvider props={props}>
        <MarkedText/>
        <OverlayTrigger/>
    </MarkedInputProvider>;
}