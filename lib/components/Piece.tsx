import {assertAnnotated, useNode, useStore} from "../utils";

export function Piece() {
    const {mark} = useNode()
    const {options, props: {Mark}} = useStore()

    assertAnnotated(mark)

    const defaultProps = {label: mark.label, value: mark.value}
    const props = options[mark.childIndex].initMark?.(defaultProps) ?? defaultProps

    return <Mark {...props}/>
}