import {RefObject, useEffect} from "react";
import {useStore} from "../../../../../utils";

export const useFocusOnEmptyInput = (spanRefs: Map<number, RefObject<HTMLSpanElement>>) => {
    const {bus} = useStore()

    useEffect(() => bus.listen("onClick", () => {
        if (spanRefs.size === 1) {
            const element = [...spanRefs.values()][0].current
            if (element?.textContent === "") {
                element.focus()
            }
        }
    }), [])
};