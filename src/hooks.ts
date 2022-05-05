import {Children, ReactElement, useEffect, useState} from "react";
import {MarkupProps} from "./Markup";
import {TagValue} from "./TaggedInput";
import {markupToRegex} from "./utils";

export const useParsedText = <T, >(
    text: string,
    children: ReactElement<MarkupProps<T>> | ReactElement<MarkupProps<T>>[],
): (string | TagValue<T>)[] => {
    const [values, setValues] = useState<(string | TagValue<T>)[]>([])

    useEffect(() => {
        let configs = Children.map(children, child => child)
        const result = extractArr(configs, text);
        setValues(result)
    }, [text])

    return values
}

function extractArr<T>(configs: ReactElement<MarkupProps<T>>[], text:string) {
    const regExps = configs.map((c) => markupToRegex(c.props.value))
    const oneRegExp = new RegExp(regExps.map(value => value.source).join("|"))
    const result: (string | TagValue<T>)[] = []

    let tail = text
    let execArray: RegExpExecArray | null = null
    while (execArray = oneRegExp.exec(tail)) {
        const {match, id, value, index, input, childIndex} = extract(execArray)

        let before = input.substring(0, index)
        let processedMatch: TagValue<T> = {
            id,
            value,
            props: configs[childIndex].props.inner,
            valueKey: configs[childIndex].props.valueKey,
            childIndex,
        }
        tail = input.substring(index + match.length)

        result.push(before, processedMatch)
    }

    result.push(tail)
    return result;
}

function extract(execArray: RegExpExecArray) {
    let match = execArray[0]

    let childIndex = 0
    let value = execArray[1]
    let id = execArray[2]
    while (true) {
        if (value || id) break

        childIndex++
        value = execArray[2 * childIndex + 1]
        id = execArray[2 * childIndex + 2]
    }

    let index = execArray.index
    let input = execArray.input
    return {match, value, id, input, index, childIndex}
}