import {useCallback, useEffect, useState} from "react";
import {genHash, isObject, markupToRegex, toString} from "../utils";
import {Action, Configs, Dispatch, Mark, Match, Payload, Slice, SliceMap, Type} from "../types";
import {MarkedInputProps} from "../MarkedInput";

//TODO Compare new input value with returned caching?
export const useSliceMap = <T, >(props: MarkedInputProps<any>, configs: Configs<any>)
    : [SliceMap<T>, Dispatch] => {
    const slices = useSlicesOf(props.value);
    const state = useKeyMapperFor(slices)
    const dispatch = useDispatcher()

    return [state, dispatch]


    function useSlicesOf(text: string) {
        const [slices, setSlices] = useState<Slice<T>[]>([])
        useEffect(() => {
            //TODO refact to smt like Parser.Parse?
            const newSlices = slice(text, configs);
            setSlices(newSlices)
        }, [text])
        return slices


        function slice<T>(text: string, configs: Configs<T>) {
            const regExp = getCombinedRegex();
            return iterateSlices();


            function getCombinedRegex() {
                const regExps = configs.map((c) => markupToRegex(c.markup))
                return new RegExp(regExps.map(value => value.source).join("|"));
            }

            function iterateSlices() {
                const result: Slice<T>[] = []
                let [span, mark, raw] = nextMatch(text)
                while (mark && raw != null) {
                    result.push(span, mark);
                    [span, mark, raw] = nextMatch(raw)
                }
                result.push(span)
                return result;
            }

            function nextMatch(text: string): [string, Mark<T> | null, string | null] {
                let match = regExp.exec(text)
                if (!match)
                    return [text, null, null]

                let [span, mark, raw] = extractSlices(match)
                return [span, mark, raw]
            }

            function extractSlices(execArray: RegExpExecArray): [string, Mark<T>, string] {
                const match = extractMatch(execArray)
                const mark = getMark(match)
                const span = match.input.substring(0, match.index)
                const raw = match.input.substring(match.index + match.annotation.length)
                return [span, mark, raw]
            }

            function extractMatch(execArray: RegExpExecArray): Match {
                let annotation = execArray[0]

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
                return {annotation, value, id, input, index, childIndex}
            }

            function getMark({childIndex, id, value}: Match): Mark<T> {
                //TODO props and match?
                //TODO match and config?
                const props = configs[childIndex].initializer(value, id)
                return {id, value, props, childIndex};
            }
        }
    }

    function useKeyMapperFor(slices: Slice<T>[]) {
        const [sliceMap, setSliceMap] = useState<SliceMap<T>>(() => new Map())
        //TODO instance prefix for keys?
        //const prefix = useState(() => genId())[0]
        useEffect(() => {
            const newMap = slices.reduce((map: SliceMap<T>, slice) => map.set(genKey(slice, map), slice), new Map())
            setSliceMap(newMap)
        }, [slices.length])
        return sliceMap

        function genKey<T>(slice: Slice<T>, newMap: Map<number, Slice<T>>) {
            let str = isObject(slice) ? slice.id + slice.value : slice
            let seed = 0
            let key = genHash(str, seed)
            while (newMap.has(key)) key = genHash(str, seed++)
            return key;
        }
    }

    function useDispatcher() {
        return useCallback((type: Type, payload: Payload) => {
            reducer(state, {type, payload})

            function reducer(state: SliceMap<T>, action: Action) {
                switch (action.type) {
                    case Type.Change:
                        const {key, value = ""} = action.payload
                        state.set(key, value)
                        props.onChange(toString([...state.values()], configs))
                        break;
                    case Type.Delete:
                        state.delete(action.payload.key)
                        props.onChange(toString([...state.values()], configs))
                        break;
                    default:
                        throw new Error();
                }
            }
        }, [state])
    }
}