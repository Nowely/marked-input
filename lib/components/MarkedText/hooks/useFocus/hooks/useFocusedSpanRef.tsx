import {FocusEvent, useRef} from "react";
import {useListener} from "../../../../../utils/useListener";

export const useFocusedSpanRef = () => {
    const spanRef = useRef<HTMLElement | null>(null)

    useListener("onFocus", (e: FocusEvent<HTMLElement>) => spanRef.current = e.target, [])
    useListener("onBlur", _ => spanRef.current = null, [])

    return spanRef
};