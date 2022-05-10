import {ComponentType, CSSProperties, ReactElement, useState} from "react";
import {EditableSpan} from "./components/EditableSpan";
import {OptionProps} from "./Option";
import {useParsedText} from "./hooks/useParsedText";
import {toString} from "./utils";
import {useHandleKeyDown} from "./hooks/useHandleKeyDown";
import {useCaret} from "./hooks/useCaret";

//TODO Processing on delete and on backspace
//TODO Correct Caret
//TODO Id processing
//TODO API
//TODO publish to npm
//TODO README
//TODO more examples: based, stylish
//TODO custom popup trigger
//TODO Processing markup

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
    const caret = useCaret()
    const textMap = useParsedText(value, children)
    const [focused, setFocused] = useState<number | null>(null)
    const handleKeyDown = useHandleKeyDown(focused, setFocused, caret, textMap, props.onChange, children)

    return (
        <div className={props.className}
             style={props.style}
             onKeyDown={handleKeyDown}
        >
            {[...textMap].map(([key, value], index) =>
                typeof value === "object"
                    ? <Mark key={value.id + value.value}
                           tabIndex={-1} {...value.props} {...{[value.valueKey]: value.value}} />
                    : <EditableSpan
                        id={key}
                        key={key}
                        caret={caret}
                        focused={focused}
                        setFocused={setFocused}
                        value={value}
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

