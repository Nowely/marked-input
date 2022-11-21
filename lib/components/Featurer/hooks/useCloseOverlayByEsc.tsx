import {useStore} from "../../../utils";
import {useEffect} from "react";
import {KEY} from "../../../constants";
import {Type} from "../../../types";

export function useCloseOverlayByEsc() {
    const {bus} = useStore()

    useEffect(() => {
        const handle = (event: KeyboardEvent) => {
            if (event.key === KEY.ESC)
                bus.send(Type.ClearTrigger)
        }

        window.addEventListener('keydown', handle)
        return () => window.removeEventListener('keydown', handle)
    }, [])
}