import {ComponentType, CSSProperties, ForwardedRef, forwardRef, Ref, useState} from "react";
import {DivEvents, MarkProps, OptionProps} from "../types";
import {MarkedText} from "./MarkedText";
import {Featurer} from "./Featurer";
import {Whisper} from "./Whisper";
import {Store} from "../utils/Store";
import {StoreProvider} from "../utils";
import "../styles.css"

export interface MarkedInputProps<T = MarkProps> {
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
    Overlay?: ComponentType
    /**
     * Prevents from changing the value
     */
    readOnly?: boolean
    /**
     * Passed options for configure
     * @Default One option with default values is used
     */
    options?: OptionProps<T>[]
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
    ref?: Ref<MarkedInputHandler>
}

export interface MarkedInputHandler {
    number: number
}

export interface MarkedInputComponent {
    <T = MarkProps>(props: MarkedInputProps<T>): JSX.Element | null
    displayName?: string
}

//export function MarkedInput<T = MarkProps>(props: MarkedInputProps<T>) {
const _MarkedInput = (props: MarkedInputProps, ref: ForwardedRef<MarkedInputHandler>) => {
    const [store] = useState(Store.create(props))

    return (
        <StoreProvider value={store}>
            <MarkedText/>
            <Whisper/>
            <Featurer props={props}/>
        </StoreProvider>
    )
}

export const MarkedInput = forwardRef(_MarkedInput) as MarkedInputComponent