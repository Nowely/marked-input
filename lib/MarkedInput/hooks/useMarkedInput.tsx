import {Action, Payload, KeyedPieces, Store, Type} from "../types";
import {useOptions} from "./useOptions";
import {useParsed} from "./useParsed";
import {MarkedInputProps} from "../index";
import {useTrigger} from "./useTrigger";
import {useCallback, useReducer, useState} from "react";
import {EventBus} from "../utils/EventBus";
import {toString} from "../utils";

export const useMarkedInput = (props: MarkedInputProps<any, any>): Store => {
    const options = useOptions(props.children)
    const pieces = useParsed(props.value, options)

    const dispatch = useDispatcher()
    const trigger = useTrigger(options)
    const forceUpdate = useReducer(x => x + 1, 0)[1];

    const bus = useState(() => new EventBus(forceUpdate))[0]

    return {options: options, props, pieces, dispatch, trigger, bus}


    function useDispatcher() {
        return useCallback((type: Type, payload: Payload) => {
            reducer(pieces, {type, payload})

            function reducer(state: KeyedPieces, action: Action) {
                switch (action.type) {
                    case Type.Change:
                        const {key, value = ""} = action.payload
                        state.set(key, value)
                        props.onChange(toString([...state.values()], options))
                        break;
                    case Type.Delete:
                        state.delete(action.payload.key)
                        props.onChange(toString([...state.values()], options))
                        break;
                    default:
                        throw new Error();
                }
            }
        }, [pieces])
    }
}