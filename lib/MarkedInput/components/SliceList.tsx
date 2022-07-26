import {isObject, useStore} from "../utils";
import {EditableSpan} from "./EditableSpan";
import {DefaultClass} from "../constants";
import {useFocus} from "../hooks/useFocus";

export const SliceList = () => {
    const {sliceMap, configs, props: {Mark, ...props}} = useStore()
    const {register, ...focusHandles} = useFocus()
    const className = props.className ? DefaultClass + " " + props.className : DefaultClass

    return (
        <div className={className} style={props.style} {...focusHandles}>
            {[...sliceMap].map(([key, slice]) => (
                    isObject(slice)
                        ? <Mark key={key} tabIndex={-1}
                                {...configs[slice.childIndex].initializer(slice.value, slice.id)} />
                        : <EditableSpan
                            ref={register(key)}
                            id={key} key={key} value={slice}/>
                )
            )}
        </div>
    )
}

