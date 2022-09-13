import {RefObject, useEffect} from "react";
import {useStore} from "../../../utils";
import {Type} from "../../../types";

export function useCloseByClickOutside(ref: RefObject<HTMLElement>) {
    const {bus} = useStore()

    useEffect(() => {
        const handleClick = (event: MouseEvent) => {
            let target = event.target as HTMLElement | null

            if (target === ref.current) return
            if (target === bus.get("TextRef").current) return
            if (target?.parentElement === bus.get("TextRef").current) return

            bus.send(Type.ClearTrigger)
        }

        document.addEventListener("click", handleClick)
        return () => document.removeEventListener("click", handleClick)
    }, [])
}