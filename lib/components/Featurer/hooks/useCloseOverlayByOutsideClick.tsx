import {RefObject, useEffect} from "react";
import {useStore} from "../../../utils";
import {Type} from "../../../types";
import {useSelector} from "../../../utils/useSelector";

export function useCloseOverlayByOutsideClick() {
    const store = useStore()
    const trigger = useSelector(state => state.trigger)

    useEffect(() => {
        if (!trigger) return

        const handleClick = (event: MouseEvent) => {
            let target = event.target as HTMLElement | null
            if (store.overlayRef.current?.contains(target) || store.containerRef.current?.contains(target)) return
            store.bus.send(Type.ClearTrigger)
        }

        document.addEventListener("click", handleClick)
        return () => document.removeEventListener("click", handleClick)
    }, [trigger])
}