import {Children, useEffect, useState} from "react";
import {genHash, isMark, markupToRegex} from "../utils";
import {Configs, Mark, Match, PassedOptions, Slice, SliceMap} from "../types";

//TODO Compare new input value with returned caching?
export const useSliceMap = <T, >(text: string, children: PassedOptions<T>): SliceMap<T> => {
    const [slices, setSlices] = useState<Slice<T>[]>([])
    const [sliceMap, setSliceMap] = useState<SliceMap<T>>(() => new Map())
    useSlicer();
    useKeyToSlicedMapper()
    return sliceMap


    function useSlicer() {
        useEffect(() => {
            const configs = extractConfigs()
            const newSlices = slice(text, configs);
            setSlices(newSlices)
        }, [text])


        function extractConfigs(): Configs<T> {
            return Children.map(children, child => child.props);
        }

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
                while (mark && raw) {
                    result.push(span, mark);
                    [span, mark, raw] = nextMatch(raw)
                }
                result.push(span)
                return result;
            }

            function nextMatch(text: string): [string, Mark<T> | null, string | null]{
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

    function useKeyToSlicedMapper() {
        //TODO instance prefix for keys?
        //const prefix = useState(() => genId())[0]
        useEffect(() => {
            const newMap = slices.reduce((map: SliceMap<T>, slice) => map.set(genKey(slice, map), slice), new Map())
            setSliceMap(newMap)
        }, [slices.length])


        function genKey<T>(slice: Slice<T>, newMap: Map<number, Slice<T>>) {
            let str = isMark(slice) ? slice.id + slice.value : slice
            let seed = 0
            let key = genHash(str, seed)
            while (newMap.has(key)) key = genHash(str, seed++)
            return key;
        }
    }
}