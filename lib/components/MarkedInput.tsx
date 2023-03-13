import {ComponentType, CSSProperties, ForwardedRef, forwardRef, useState} from "react"
import "../styles.css"
import {DivEvents, MarkedInputHandler, MarkStruct, OptionProps} from "../types"
import {StoreProvider} from "../utils"
import {Store} from "../utils/Store"
import {Featurer} from "./Featurer"
import {MarkedText} from "./MarkedText"
import {Whisper} from "./Whisper"

export interface MarkedInputProps<T = MarkStruct> {
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
     * @default One option with default values is used
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
    /**
     * Ref to handler
     */
    ref?: ForwardedRef<MarkedInputHandler>
}

export interface MarkedInputComponent {
    <T = MarkStruct>(props: MarkedInputProps<T>): JSX.Element | null
    displayName?: string
}

export const MarkedInput = forwardRef(_MarkedInput) as MarkedInputComponent

export function _MarkedInput(props: MarkedInputProps, ref: ForwardedRef<MarkedInputHandler>) {
    const [store] = useState(Store.create(props))
    return (
        <StoreProvider value={store}>
            <MarkedText/>
            <Whisper/>
            <Featurer ref={ref} props={props}/>
        </StoreProvider>
    )
}
