import {ComponentType, CSSProperties} from "react";
import {EditableSpan} from "./components/EditableSpan";
import {useSliceMap} from "./hooks/useSliceMap";
import {isMark, toString} from "./utils";
import {useHandleKeyDown} from "./hooks/useHandleKeyDown";
import {useCaret} from "./hooks/useCaret";
import {useFocus} from "./hooks/useFocus";
import {PassedOptions} from "./types";

//TODO publish to npm
//TODO custom popup trigger

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

export const MarkedInput = <T, >({Mark, value, children, ...props}: MarkedInputProps<T>) => {
    const sliceMap = useSliceMap(value, children)
    const caret = useCaret()
    const focus = useFocus()
    const handleKeyDown = useHandleKeyDown(caret, sliceMap, props.onChange, children, focus)

    return (
        <div className={props.className} style={props.style} onKeyDown={handleKeyDown}>
            {[...sliceMap].map(([key, value]) =>
                isMark(value)
                    ? <Mark key={key} tabIndex={-1} {...value.props} />
                    : <EditableSpan
                        id={key}
                        key={key}
                        caret={caret}
                        value={value}
                        focus={focus}
                        className={props.spanClassName}
                        style={props.spanStyle}
                        onChange={(newValue: string) => {
                            sliceMap.set(key, newValue)
                            props.onChange(toString([...sliceMap.values()], children))
                        }}
                    />
            )}
        </div>
    )
}