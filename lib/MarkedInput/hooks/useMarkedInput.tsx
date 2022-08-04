import {Store} from "../types";
import {useOptions} from "./useOptions";
import {useSliceMap} from "./useSliceMap";
import {MarkedInputProps} from "../index";
import {useTrigger} from "./useTrigger";

export const useMarkedInput = (props: MarkedInputProps<any, any>): Store => {
    const options = useOptions(props.children)
    const [sliceMap, dispatch] = useSliceMap(props, options)
    const trigger = useTrigger(options)

    return {options: options, props, sliceMap, dispatch, trigger}
}