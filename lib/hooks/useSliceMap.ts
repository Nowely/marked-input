import {useCallback, useMemo} from "react";
import {genHash, isObject, toString} from "../utils";
import {Action, Configs, Dispatch, Payload, Slice, SliceMap, Type} from "../types";
import {MarkedInputProps} from "../components/MarkedInput";
import {Parser} from "../utils/Parser";

//TODO Compare new input value with returned caching?
export const useSliceMap = <T, >({value, onChange}: MarkedInputProps<any>, configs: Configs<any>)
    : [SliceMap<T>, Dispatch] => {
    const slices = useMemo(() => Parser.split(value, configs), [value])
    const sliceMap = useMemo(sliceToKeyMapper, [slices.length])
    const dispatch = useDispatcher()

    return [sliceMap, dispatch]


    function sliceToKeyMapper() {
        return slices.reduce((map: SliceMap<T>, slice) => map.set(genKey(slice, map), slice), new Map())

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
            reducer(sliceMap, {type, payload})

            function reducer(state: SliceMap<T>, action: Action) {
                switch (action.type) {
                    case Type.Change:
                        const {key, value = ""} = action.payload
                        state.set(key, value)
                        onChange(toString([...state.values()], configs))
                        break;
                    case Type.Delete:
                        state.delete(action.payload.key)
                        onChange(toString([...state.values()], configs))
                        break;
                    default:
                        throw new Error();
                }
            }
        }, [sliceMap])
    }
}