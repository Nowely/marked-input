import {ComponentType, ReactElement, useCallback, useEffect, useState} from "react";
import {EditableCell} from "./components/EditableCell";
import {MarkupProps} from "./Markup";
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

interface TaggedInputProps<T> {
    value: string
    onChange: (value: string) => void
    Tag: ComponentType<T>
    children: ReactElement<MarkupProps<T>> | ReactElement<MarkupProps<T>>[]
}

export const TaggedInput = <T, >({Tag, value, children, ...props}: TaggedInputProps<T>) => {
    const caret = useCaret()
    const textMap = useParsedText(value, children)
    const [focused, setFocused] = useState<number | null>(null)
    const handleKeyDown = useHandleKeyDown(focused, setFocused, caret, textMap, props.onChange, children)

    return (
        <div onKeyDown={handleKeyDown}>
            {[...textMap].map(([key, value], index) =>
                typeof value === "object"
                    ? <Tag key={value.id + value.value}
                           tabIndex={-1} {...value.props} {...{[value.valueKey]: value.value}} />
                    : <EditableCell
                        id={key}
                        key={key}
                        caret={caret}
                        focused={focused}
                        setFocused={setFocused}
                        value={value}
                        onChange={(newValue: string) => {
                            textMap.set(key, newValue)
                            props.onChange(toString([...textMap.values()], children))
                        }}
                    />
            )}
        </div>
    )
}

