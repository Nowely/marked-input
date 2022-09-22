import {isObject, useStore, useStore1} from "../../utils";
import {EditableSpan} from "../EditableSpan";
import {DefaultClass} from "../../constants";
import {useFocus} from "./hooks/useFocus";
import {useSharedRef} from "./hooks/useSharedRef";
import {memo, useMemo, useReducer} from "react";
import {useListener} from "../../utils/useListener";
import {Type} from "../../types";

export const MarkedText = memo(() => {
    const {bus, options, textProps: {Mark, ...props}} = useStore()
    const pieces = useStore1()
    const {register} = useFocus()
    const className = props.className ? DefaultClass + " " + props.className : DefaultClass
    const ref = useSharedRef();
    const events = useMemo(() => bus.events, [bus])

    return (
        <div ref={ref} className={className} style={props.style} {...events}>
            {[...pieces].map(([key, piece]) => {
                if (!isObject(piece))
                    return <EditableSpan ref={register(key)} id={key} key={key} value={piece}/>

                const markProps = options[piece.childIndex].initMark?.(piece) ?? piece
                return <Mark key={key} tabIndex={-1} {...markProps}/>
            })}
        </div>
    )
})