import {MarkProps, NodeData} from "../types";
import {isAnnotated, useStore} from "../utils";
import {EditableSpan} from "./EditableSpan";
import {useMark} from "../utils/useMark";

export function Piece({node}: { node: NodeData }) {
    const {options, props: {Mark}} = useStore()

    const defaultProps = getDefaultProps(node)

    if (!isAnnotated(node.piece)) return <EditableSpan {...defaultProps}/>

    const props = options[node.piece.childIndex].initMark?.(defaultProps) ?? defaultProps
    // @ts-ignore
    return <Mark {...props}/>
}

function getDefaultProps(node: NodeData): MarkProps {
    const boundUseMark = useMark.bind(null, node)
    return {
        label: node.piece.label,
        value: node.piece.value,
    // @ts-ignore
        useMark: boundUseMark
    }
}