import {RefObject, useEffect} from "react";
import {useStore} from "../../../utils";
import {Type} from "../../../types";

export function useCloseByOutsideClick(overlayRef: RefObject<HTMLElement>) {
    const {bus} = useStore()

    useEffect(() => {
        const handleClick = (event: MouseEvent) => {
            let target = event.target as HTMLElement | null
            if (overlayRef.current?.contains(target) || bus.get("TextRef").current?.contains(target)) return;
            bus.send(Type.ClearTrigger)
        }

        document.addEventListener("click", handleClick)
        return () => document.removeEventListener("click", handleClick)
    }, [])
}