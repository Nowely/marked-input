import {isObject, useStore} from "../utils";
import {useHandleKeyDown} from "../hooks/useHandleKeyDown";
import {EditableSpan} from "./EditableSpan";
import {DefaultClass} from "../constants";

export const SliceList = () => {
    const {sliceMap, configs, props: {Mark, ...props}} = useStore()
    const handleKeyDown = useHandleKeyDown()
    const className = props.className ? DefaultClass + " " + props.className : DefaultClass

    return (
        <div className={className} style={props.style} onKeyDown={handleKeyDown}>
            {[...sliceMap].map(([key, slice]) => (
                    isObject(slice)
                        ? <Mark key={key} tabIndex={-1}
                                {... configs[slice.childIndex].initializer(slice.value, slice.id)} />
                        : <EditableSpan id={key} key={key} value={slice}/>
                )
            )}
        </div>
    )
}