import {ComponentType, CSSProperties} from "react";
import {StoreProvider} from "./utils";
import {PassedOptions} from "./types";
import {SliceList} from "./components/SliceList";
import "./style.css"
import {useMarkedInput} from "./hooks/useMarkedInput";

export interface MarkedInputProps<T> {
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
     * Prevents from changing the value
     */
    readOnly?: boolean
    /**
     * Passed options for configure
     */
    children: PassedOptions<T>
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

export const MarkedInput = <T, >(props: MarkedInputProps<T>) => {
    const store = useMarkedInput(props)
    return (
        <StoreProvider value={store}>
            <SliceList/>
        </StoreProvider>
    )
}