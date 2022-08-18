import {Store} from "../types";
import {useOptions} from "./useOptions";
import {useSliceMap} from "./useSliceMap";
import {MarkedInputProps} from "../index";
import {useTrigger} from "./useTrigger";
import {useReducer, useState} from "react";
import {EventBus} from "../utils/EventBus";

export const useMarkedInput = (props: MarkedInputProps<any, any>): Store => {
    const options = useOptions(props.children)
    const [sliceMap, dispatch] = useSliceMap(props, options)
    const trigger = useTrigger(options)
    const [, forceUpdate] = useReducer(x => x + 1, 0);

    const bus = useState(() => new EventBus(forceUpdate))[0]

    return {options: options, props, sliceMap, dispatch, trigger, bus}
}