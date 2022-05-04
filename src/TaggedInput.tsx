import {ComponentType, ReactElement, useRef, useState} from "react";
import {EditableCell} from "./components/EditableCell";
import {MarkupProps} from "./Markup";
import {useParsedText} from "./hooks";

//TODO Id processing
//TODO Correct Caret
//TODO Processing on delete and on backspace
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
    value: string
    props: T
    valueKey: string
    childIndex: number
}

export const TaggedInput = <T, >({Tag, value, children, ...props}: TaggedInputProps<T>) => {
    const values = useParsedText(value, children)
    const [active, setActive] = useState<null | number>(null)
    const isTail = useRef(false)

    const onNext = () => {
        if (active != values.length - 1)
            setActive(active! + 1)
    }
    const onPrevious = () => {
        if (active) {
            isTail.current = true
            setActive(active - 1)
        }
    }
    const onRemove = () => {
        /*let regExp = new RegExp(/@\w+/, "g")
        let newValue = value?.replace(regExp, (match, index, allText, c) => {
            if (index === indexes[(active ?? 0) - 1]) return ""
            return match
        })
        props.onChange?.(newValue ?? "")*/
        //TODO caret
    }

    return (
        <div>
            {values.map((value, index) =>
                typeof value === "object"
                    ? <Tag tabIndex={-1} {...value.props} {...{[value.valueKey]: value.value}} />
                    : <EditableCell
                        //key={value}
                        index={index}
                        active={active}
                        next={onNext}
                        previous={onPrevious}
                        remove={onRemove}
                        setActive={setActive}
                        value={value}
                        isTail={isTail}
                        onChange={(newValue: string) => {
                            values[index] = newValue
                        }}
                        onBlur={() => {
                            //props.onChange?.(values.join(""))
                        }}
                    />
            )}
        </div>
    )
}