import {isObject, useStore} from "../utils";
import {EditableSpan} from "./EditableSpan";
import {DefaultClass} from "../constants";
import {useFocus} from "../hooks/useFocus";

export const SliceList = () => {
    const {sliceMap, options, props: {Mark, ...props}, trigger: {check, clear}} = useStore()
    const {register, ...focusHandles} = useFocus(check, clear)
    const className = props.className ? DefaultClass + " " + props.className : DefaultClass

    return (
        <div className={className} style={props.style} {...focusHandles}>
            {[...sliceMap].map(([key, slice]) => {
                if (!isObject(slice))
                    return <EditableSpan ref={register(key)} id={key} key={key} value={slice}/>

                const markProps = options[slice.childIndex].initMark?.(slice) ?? slice
                return <Mark key={key} tabIndex={-1} {...markProps}/>
            })}
        </div>
    )
}