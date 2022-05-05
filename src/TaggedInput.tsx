import {ComponentType, KeyboardEvent, ReactElement, useEffect, useState} from "react";
import {EditableCell} from "./components/EditableCell";
import {MarkupProps} from "./Markup";
import {useParsedText} from "./hooks";
import {KEY} from "./constants";
import {getCaretIndex, toString} from "./utils";

//TODO Processing on delete and on backspace
//TODO Correct Caret
//TODO Id processing
//TODO API
//TODO Demo
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

export type TagValue<T> = {
    id: string
    value: string
    props: T
    valueKey: string
    childIndex: number
}

export const TaggedInput = <T, >({Tag, value, children, ...props}: TaggedInputProps<T>) => {
    const values = useParsedText(value, children)
    const [activeIndex, setActiveIndex] = useState<null | number>(null)

    const onPressLeft = (target: HTMLSpanElement) => {
        if (activeIndex != null) {
            let newIndex = Math.abs(activeIndex) - 2
            setActiveIndex(-newIndex)
        }
    }

    const onPressRight = (target: HTMLSpanElement) => {
        if (activeIndex != null)
            setActiveIndex(Math.abs(activeIndex) + 2)
    }

    const onPressBackspace = (target: HTMLSpanElement) => {
        /*let regExp = new RegExp(/@\w+/, "g")
        let newValue = value?.replace(regExp, (match, index, allText, c) => {
            if (index === indexes[(active ?? 0) - 1]) return ""
            return match
        })
        props.onChange?.(newValue ?? "")*/
        //TODO caret
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
        const target = event.target as HTMLSpanElement
        const caretIndex = getCaretIndex(target);
        const isStartCaret = caretIndex === 0;
        const isEndCaret = caretIndex === target.textContent?.length;

        //TODO to object map
        switch (event.key) {
            case KEY.LEFT:
                isStartCaret && onPressLeft(target)
                break
            case KEY.RIGHT:
                isEndCaret && onPressRight(target)
                break
            case KEY.UP: //TODO to start input position
            case KEY.DOWN: //TODO to end input position
                break;
            case KEY.BACKSPACE:
                isStartCaret && onPressBackspace(target)
                break
        }
    }

    return (
        <div onKeyDown={handleKeyDown}>
            {values.map((value, index) =>
                typeof value === "object"
                    ? <Tag /*key={value.value}*/ tabIndex={-1} {...value.props} {...{[value.valueKey]: value.value}} />
                    : <EditableCell
                        //key={value}
                        index={index}
                        active={activeIndex}
                        setActive={setActiveIndex}
                        value={value}
                        onChange={(newValue: string) => {
                            values[index] = newValue
                            props.onChange(toString(values, children))
                        }}
                    />
            )}
        </div>
    )
}

