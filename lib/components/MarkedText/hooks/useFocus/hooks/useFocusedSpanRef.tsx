import {useStore} from "../../../../../utils";
import {FocusEvent, useEffect, useRef} from "react";

export const useFocusedSpanRef = () => {
    const {bus} = useStore()
    const spanRef = useRef<HTMLElement | null>(null)

    useEffect(() => bus.listen("onFocus", (e: FocusEvent<HTMLElement>) => spanRef.current = e.target), [])
    useEffect(() => bus.listen("onBlur", _ => spanRef.current = null), [])

    return spanRef
};