import {assertAnnotated, useNode} from "../utils";
import {useProps} from "../utils/useProps";

export function Piece() {
    const {mark} = useNode()
    const {options, Mark} = useProps(state => ({options: state.options, Mark: state.Mark}), true)

    assertAnnotated(mark)

    const defaultProps = {label: mark.label, value: mark.value}
    const props = options[mark.childIndex].initMark?.(defaultProps) ?? defaultProps

    //TODO correct typing
    // @ts-ignore
    return <Mark {...props}/>
}