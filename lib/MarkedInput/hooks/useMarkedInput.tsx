import {Store} from "../types";
import {useCaret} from "./useCaret";
import {useConfigs} from "./useConfigs";
import {useSliceMap} from "./useSliceMap";
import {MarkedInputProps} from "../index";

export const useMarkedInput = (props: MarkedInputProps<any>): Store => {
    const caret = useCaret()
    const configs = useConfigs(props.children)
    const [sliceMap, dispatch] = useSliceMap(props, configs)

    return {caret, configs, props, sliceMap, dispatch}
}