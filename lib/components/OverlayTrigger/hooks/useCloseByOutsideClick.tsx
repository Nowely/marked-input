import {RefObject, useEffect} from "react";
import {useStore} from "../../../utils";
import {Type} from "../../../types";

export function useCloseByOutsideClick(overlayRef: RefObject<HTMLElement>) {
    const store = useStore()

    useEffect(() => {
        const handleClick = (event: MouseEvent) => {
            let target = event.target as HTMLElement | null
            if (overlayRef.current?.contains(target) || store.containerRef.current?.contains(target)) return
            store.bus.send(Type.ClearTrigger)
        }

        document.addEventListener("click", handleClick)
        return () => document.removeEventListener("click", handleClick)
    }, [])
}