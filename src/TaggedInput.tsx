import {Children, ComponentType, Fragment, ReactElement, useEffect, useRef, useState} from "react";
import {EditableCell} from "./components/EditableCell";
import {MarkupProps} from "./Markup";


interface TaggedInputProps<T> {
    value: string
    onChange: (value: string) => void
    Tag: ComponentType<T>
    children: ReactElement<MarkupProps<T>> //| ReactElement<MarkupProps & T>[]
}

type TagValue<T> = {
    value: string
    props: T
}

export const TaggedInput = <T, >({Tag, ...props}: TaggedInputProps<T>) => {
    const [values, setValues] = useState<(string | TagValue<T>)[]>([])
    const [active, setActive] = useState<null | number>(null)
    const isTail = useRef(false)
    const indexes = useRef<number[]>([])

    const child = Children.only(props.children)

    useEffect(() => {
        let regExp = new RegExp(/@\w+/, "g")
        let newValues: (string | TagValue<T>)[] = props.value.split(regExp)

        let i = 1
        indexes.current = []
        let execArray = regExp.exec(props.value)
        while (execArray) {
            indexes.current.push(execArray.index)
            newValues.splice(i, 0, {
                value: execArray[0].substring(1),
                props: child.props.inner,
            })
            i = i + 2
            execArray = regExp.exec(props.value)
        }
        setValues(newValues)
    }, [props.value])


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
        let regExp = new RegExp(/@\w+/, "g")
        let newValue = props.value?.replace(regExp, (match, index, allText, c) => {
            if (index === indexes.current[(active ?? 0) - 1]) return ""
            return match
        })
        props.onChange?.(newValue ?? "")
        //TODO caret
    }

    return (
        <div>
            {values.map((value, index) =>
                typeof value === "object"
                    ? <Tag {...value.props}/>
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
