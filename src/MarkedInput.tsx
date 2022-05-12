import {ComponentType, CSSProperties, ReactElement, useState} from "react";
import {EditableSpan} from "./components/EditableSpan";
import {OptionProps} from "./Option";
import {useParsedText} from "./hooks/useParsedText";
import {isMark, toString} from "./utils";
import {useHandleKeyDown} from "./hooks/useHandleKeyDown";
import {useCaret} from "./hooks/useCaret";
import {useFocus} from "./hooks/useFocus";

//TODO publish to npm
//TODO custom popup trigger

interface MarkedInputProps<T> {
    value: string
    onChange: (value: string) => void
    Mark: ComponentType<T>
    children: ReactElement<OptionProps<T>> | ReactElement<OptionProps<T>>[]
    className?: string
    style?: CSSProperties
    spanClassName?: string
    spanStyle?: CSSProperties
}

export const MarkedInput = <T, >({Mark, value, children, ...props}: MarkedInputProps<T>) => {
    const textMap = useParsedText(value, children)
    const caret = useCaret()
    const focus = useFocus()
    const handleKeyDown = useHandleKeyDown(caret, textMap, props.onChange, children, focus)

    return (
        <div className={props.className} style={props.style} onKeyDown={handleKeyDown}>
            {[...textMap].map(([key, value], index) =>
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
                            textMap.set(key, newValue)
                            props.onChange(toString([...textMap.values()], children))
                        }}
                    />
            )}
        </div>
    )
}

