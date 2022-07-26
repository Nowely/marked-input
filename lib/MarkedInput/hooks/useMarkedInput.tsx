import {Store} from "../types";
import {useConfigs} from "./useConfigs";
import {useSliceMap} from "./useSliceMap";
import {MarkedInputProps} from "../index";

export const useMarkedInput = (props: MarkedInputProps<any>): Store => {
    const configs = useConfigs(props.children)
    const [sliceMap, dispatch] = useSliceMap(props, configs)

    return {configs, props, sliceMap, dispatch}
}