import {Store} from "../types";
import {useConfigs} from "./useConfigs";
import {useSliceMap} from "./useSliceMap";
import {MarkedInputProps} from "../index";
import {useTrigger} from "./useTrigger";

export const useMarkedInput = (props: MarkedInputProps<any, any>): Store => {
    const configs = useConfigs(props.children)
    const [sliceMap, dispatch] = useSliceMap(props, configs)
    const trigger = useTrigger(configs)

    return {configs, props, sliceMap, dispatch, trigger}
}