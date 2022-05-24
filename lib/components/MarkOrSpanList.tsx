import {isObject, useStore} from "../utils";
import {useHandleKeyDown} from "../hooks/useHandleKeyDown";
import {EditableSpan} from "./EditableSpan";

export const MarkOrSpanList = () => {
    const {Mark, configs, sliceMap, ...props} = useStore()
    const handleKeyDown = useHandleKeyDown()

    return (
        <div className={props.className} style={props.style} onKeyDown={handleKeyDown}>
            {[...sliceMap].map(([key, value]) => (
                    isObject(value)
                        ? <Mark key={key} tabIndex={-1} {...value.props} />
                        : <EditableSpan id={key} key={key} value={value}/>
                )
            )}
        </div>
    )
}