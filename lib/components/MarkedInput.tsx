import {ComponentType, CSSProperties, useState} from "react";
import {DivEvents, ElementOptions, MarkProps, OverlayProps} from "../types";
import {MarkedText} from "./MarkedText";
import {OptionProps} from "./Option";
import {Featurer} from "./Featurer";
import {Whisper} from "./Whisper";
import {Store} from "../utils/Store";
import {StoreProvider} from "../utils";
import "../styles.css"

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
    /**
     * Forward div events to a text container
     */
    onContainer?: DivEvents
}

export function MarkedInput<T = MarkProps, T1 = OverlayProps>(props: MarkedInputProps<T, T1>) {
    const store = useState(() => Store.create(props))[0]
    return (
        <StoreProvider value={store}>
            <MarkedText/>
            <Whisper/>
            <Featurer props={props}/>
        </StoreProvider>
    )
}