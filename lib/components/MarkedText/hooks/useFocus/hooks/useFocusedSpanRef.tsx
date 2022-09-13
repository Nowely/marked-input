import {useStore} from "../../../../../utils";
import {FocusEvent, useEffect, useRef} from "react";

export const useFocusedSpanRef = () => {
    const {bus} = useStore()
    const elementRef = useRef<HTMLElement | null>(null)

    useEffect(() => bus.listen("onFocus", (e: FocusEvent<HTMLElement>) =>
        elementRef.current = e.target
    ), [])

    useEffect(() => bus.listen("onBlur", e =>
        elementRef.current = null
    ), [])

    return elementRef
};