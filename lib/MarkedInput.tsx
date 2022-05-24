import {ComponentType, CSSProperties} from "react";
import {useSliceMap} from "./hooks/useSliceMap";
import {StoreProvider} from "./utils";
import {useCaret} from "./hooks/useCaret";
import {useFocus} from "./hooks/useFocus";
import {PassedOptions} from "./types";
import {useConfigs} from "./hooks/useConfigs";
import {MarkOrSpanList} from "./components/MarkOrSpanList";

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

export const MarkedInput = <T, >({children, ...props}: MarkedInputProps<T>) => {
    const caret = useCaret(), focus = useFocus(), configs = useConfigs(children)
    const sliceMap = useSliceMap(props.value, configs)

    return (
        <StoreProvider value={{...props, configs, caret, focus, sliceMap}}>
            <MarkOrSpanList/>
        </StoreProvider>
    )
}