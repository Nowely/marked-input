import {Children, ReactElement, useEffect, useMemo, useState} from "react";
import {OptionProps} from "../Option";
import {genHash, genId, markupToRegex} from "../utils";
import {TagValue} from "../types";

export const useParsedText = <T, >(
    text: string,
    children: ReactElement<OptionProps<T>> | ReactElement<OptionProps<T>>[],
//): (string | TagValue<T>)[] => {
): Map<number, string | TagValue<T>> => {
    const [values, setValues] = useState<(string | TagValue<T>)[]>([])

    useEffect(() => {
        let configs = Children.map(children, child => child)
        const result = extractArr(configs, text);
        setValues(result)
    }, [text])

    //TODO instance prefix for keys
    //TODO Compare new input value with returned
    const prefix = useState(() => genId())[0]
    const [map, setMap] = useState<Map<number, string | TagValue<T>>>(new Map())
    useEffect(() => {
        let newMap = new Map<number, string | TagValue<T>>()
        for (let value of values){
            let str = typeof value === 'string' ? value : value.id + value.value
            let seed = 0
            let key = genHash(str, seed)
            while (newMap.has(key))
                key = genHash(str, seed++)
            newMap.set(key, value)
        }
        setMap(newMap)
        /*let entries: [string, string | TagValue<T>][] = values.map(v => [genKey(), v])
        setMap(new Map(entries))*/
    }, [values.length])

    return map
}

function extractArr<T>(configs: ReactElement<OptionProps<T>>[], text:string) {
    const regExps = configs.map((c) => markupToRegex(c.props.markup))
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