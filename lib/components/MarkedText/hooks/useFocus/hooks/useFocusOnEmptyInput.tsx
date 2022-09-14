import {RefObject} from "react";
import {useListener} from "../../../../../utils/useListener";

export const useFocusOnEmptyInput = (spanRefs: Map<number, RefObject<HTMLSpanElement>>) => {
    useListener("onClick", () => {
        if (spanRefs.size === 1) {
            const element = [...spanRefs.values()][0].current
            if (element?.textContent === "") {
                element.focus()
            }
        }
    }, [])
};