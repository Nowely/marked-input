import {isObject, useStore} from "../utils";
import {EditableSpan} from "./EditableSpan";
import {DefaultClass} from "../constants";
import {useFocus} from "../hooks/useFocus";
import {useTrigger} from "../hooks/useTrigger";
import {useRef} from "react";

export const SliceList = () => {
    const {sliceMap, configs, props: {Mark, Speaker, ...props}} = useStore()
    const {word, check, clear} = useTrigger()
    const {register, ...focusHandles} = useFocus(check, clear)
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
            {word && Speaker && <Speaker {...configs[0]?.triggerInitializer?.(word)}/>}
        </div>
    )
}