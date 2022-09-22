import {isObject, useStore} from "../../utils";
import {EditableSpan} from "../EditableSpan";
import {DefaultClass} from "../../constants";
import {useFocus} from "./hooks/useFocus";
import {useSharedRef} from "./hooks/useSharedRef";
import {memo, useMemo} from "react";

export const MarkedText = memo(() => {
    const {pieces, bus, options, textProps: {Mark, ...props}} = useStore()
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