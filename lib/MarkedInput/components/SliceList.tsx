import {isObject, useStore} from "../utils";
import {EditableSpan} from "./EditableSpan";
import {DefaultClass} from "../constants";
import {useFocus} from "../hooks/useFocus";
import {useEffect} from "react";

export const SliceList = () => {
    const {sliceMap, caret, configs, props: {Mark, ...props}} = useStore()
    const {mapper, handleFocus, focusedKey, handleBlur, handleKeyDown} = useFocus()
    const className = props.className ? DefaultClass + " " + props.className : DefaultClass

    return (
        <div
            className={className}
            style={props.style}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
        >
            {[...sliceMap].map(([key, slice]) => (
                    isObject(slice)
                        ? <Mark key={key} tabIndex={-1}
                                {...configs[slice.childIndex].initializer(slice.value, slice.id)} />
                        : <EditableSpan
                        focused={focusedKey}
                            ref={mapper(key)}
                            id={key} key={key} value={slice}/>
                )
            )}
        </div>
    )
}

