import {isObject, useStore, useValue, RegisterProvider} from "../../utils";
import {EditableSpan} from "../EditableSpan";
import {DefaultClass} from "../../constants";
import {useFocus} from "./hooks/useFocus";
import {useSharedRef} from "./hooks/useSharedRef";
import {memo, ReactNode, useEffect, useMemo, useReducer} from "react";
import {useListener} from "../../utils/useListener";
import {Type} from "../../types";
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
            if (!isObject(node.piece))
                return <EditableSpan
                    key={node.key} label={node.piece}
                    useMark={useMark.bind(null, node)}
                />

            const markProps = options[node.piece.childIndex].initMark?.(node.piece) ?? node.piece
            return <Mark key={node.key} {...markProps}/>
        })}
    </>
}