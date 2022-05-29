import {Store} from "../types";
import {useCaret} from "./useCaret";
import {useFocus} from "./useFocus";
import {useConfigs} from "./useConfigs";
import {useSliceMap} from "./useSliceMap";
import {MarkedInputProps} from "../components/MarkedInput";

export const useMarkedInput = (props: MarkedInputProps<any>): Store => {
    const caret = useCaret()
    const focus = useFocus()
    const configs = useConfigs(props.children)
    const [sliceMap, dispatch] = useSliceMap(props, configs)

    return {caret, focus, configs, props, sliceMap, dispatch}
}