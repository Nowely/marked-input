import {Trigger} from "../../../types";
import {useStore} from "../../../utils";
import {useEffect, useRef} from "react";
import {KEY} from "../../../constants";

export function useAutoClose(trigger: Trigger | undefined, onClose: () => any) {
    const {bus} = useStore()
    const ref = useRef<HTMLElement>(null)

    useCloseByEsc()
    useCloseByClickOutside()

    return ref


    function useCloseByEsc() {
        useEffect(() => {
            if (!trigger) return
            const handle = (event: KeyboardEvent) => {
                if (event.key === KEY.ESC)
                    onClose()
            }
            window.addEventListener('keydown', handle)
            return () => window.removeEventListener('keydown', handle)
        }, [trigger])
    }

    function useCloseByClickOutside() {
        useEffect(() => {
            if (!trigger || !ref.current) return
            const x = (event: MouseEvent) => {
                let target = event.target as HTMLElement | null

                if (target === ref.current) return
                if (target === bus.get("TextRef").current) return
                if (target?.parentElement === bus.get("TextRef").current) return

                onClose()
            }
            document.addEventListener("click", x)
            return () => document.removeEventListener("click", x)
        }, [trigger])
    }
}