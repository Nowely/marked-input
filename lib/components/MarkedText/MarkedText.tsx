import {isObject, useStore, useValue, RegisterProvider, isAnnotated} from "../../utils";
import {EditableSpan} from "../EditableSpan";
import {DefaultClass} from "../../constants";
import {useFocus} from "./hooks/useFocus";
import {useSharedRef} from "./hooks/useSharedRef";
import {memo, ReactNode, useEffect, useMemo, useReducer} from "react";
import {useListener} from "../../utils/useListener";
import {MarkProps, NodeData, Type} from "../../types";
import {useMark} from "../../utils/useMark";

export const MarkedText = memo(() => {
    const {bus, props: {className, style}} = useStore()
    const divClassName = className ? DefaultClass + " " + className : DefaultClass
    const ref = useSharedRef();
    const events = useMemo(() => bus.events, [])

    return (
        <div ref={ref} className={divClassName} style={style} {...events}>
            <Pieces/>
        </div>
    )
})

function Pieces() {
    const {options, props: {Mark}} = useStore()
    const pieces = useValue()
    useFocus()

    return <>
        {pieces.toArray().map((node) => {
            const defaultProps = getDefaultProps(node)

            if (!isAnnotated(node.piece))
                return <EditableSpan key={node.key} {...defaultProps}/>

            const props = options[node.piece.childIndex].initMark?.(defaultProps) ?? defaultProps
            return <Mark key={node.key} {...props}/>
        })}
    </>
}

function getDefaultProps(node: NodeData): MarkProps {
    const boundUseMark = useMark.bind(null, node)
    return {
        label: node.piece.label,
        value: node.piece.value,
        useMark: boundUseMark
    }
}