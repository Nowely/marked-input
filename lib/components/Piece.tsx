import {assertAnnotated, useNode, useStore} from "../utils";
import {useSelector} from "../utils/useSelector";

export function Piece() {
    const {mark} = useNode()
    const {options, Mark} = useSelector(state => ({options: state.options, Mark: state.Mark}))

    assertAnnotated(mark)

    const defaultProps = {label: mark.label, value: mark.value}
    const props = options[mark.childIndex].initMark?.(defaultProps) ?? defaultProps

    //TODO correct typing
    // @ts-ignore
    return <Mark {...props}/>
}