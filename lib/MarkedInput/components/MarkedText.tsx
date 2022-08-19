import {isObject, useStore} from "../utils";
import {EditableSpan} from "./EditableSpan";
import {DefaultClass} from "../constants";
import {useFocus} from "../hooks/useFocus";

export const MarkedText = () => {
    const {pieces, options, props: {Mark, ...props}, trigger: {check, clear}, bus} = useStore()
    const {register, ...focusHandles} = useFocus(check, clear)
    const className = props.className ? DefaultClass + " " + props.className : DefaultClass

    return (
        <div className={className} style={props.style} {...focusHandles}
             //onFocus={bus.notify1("onFocus")}
             {...bus.events}
        >
            {[...pieces].map(([key, piece]) => {
                if (!isObject(piece))
                    return <EditableSpan ref={register(key)} id={key} key={key} value={piece}/>

                const markProps = options[piece.childIndex].initMark?.(piece) ?? piece
                return <Mark key={key} tabIndex={-1} {...markProps}/>
            })}
        </div>
    )
}