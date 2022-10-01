import {FocusEvent, useRef} from "react";
import {useListener} from "../../../../../utils/useListener";
import {useValue} from "../../../../../utils";
import {NodeData} from "../../../../../types";

export const useFocusedSpanRef = () => {
    const list = useValue()
    const spanRef = useRef<NodeData | undefined>()

    useListener("onFocus", (e: FocusEvent<HTMLElement>) => {
        spanRef.current = list.find(data => data.ref?.current === e.target)
    }, [list])
    useListener("onBlur", _ => spanRef.current = undefined, [])

    return spanRef
};